from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import (
    ChatMessage,
    DesignVersion,
    FeedbackEvent,
    GeneratedImage,
    Preference,
    Project,
    ProjectLink,
    UserProfile,
)
from .learning import process_feedback_event
from .llm import generate_agent_response, generate_design_suggestions
from .retrieval import get_canonical_version, resolve_context
from .serializers import (
    ChatMessageSerializer,
    DesignVersionSerializer,
    FeedbackEventSerializer,
    GeneratedImageSerializer,
    PreferenceSerializer,
    ProjectLinkSerializer,
    ProjectSerializer,
    UserProfileSerializer,
)


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})


@api_view(['POST'])
def resolve_context_view(request):
    user_id = request.data.get('user_id')
    message = request.data.get('message', '')
    project_id = request.data.get('project_id')
    if not user_id:
        return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    payload = resolve_context(user_id=user_id, message=message, project_id=project_id)
    return Response(payload)


@api_view(['POST'])
def assistant_suggest(request):
    user_id = request.data.get('user_id')
    project_id = request.data.get('project_id')
    message = request.data.get('message', '')
    if not user_id or not project_id:
        return Response(
            {'detail': 'user_id and project_id are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    context = resolve_context(user_id=user_id, message=message, project_id=project_id)
    suggestions = generate_design_suggestions(context, message)
    return Response(
        {
            'context': context,
            'suggestions': suggestions.get('suggestions', []),
            'image_prompts': suggestions.get('image_prompts', []),
        }
    )


@api_view(['POST'])
def agent_chat(request):
    project_id = request.data.get('project_id')
    message = request.data.get('message', '')
    if not project_id or not message:
        return Response(
            {'detail': 'project_id and message are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    project = Project.objects.filter(id=project_id, user=request.user).first()
    if not project:
        return Response({'detail': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    user_message = ChatMessage.objects.create(
        user=request.user,
        project=project,
        role='user',
        content=message,
    )

    context = resolve_context(user_id=request.user.id, message=message, project_id=project.id)
    try:
        llm_payload = generate_agent_response(context, message)
    except Exception:
        llm_payload = {
            'reply': 'I hit a snag generating a full response, but I can still help.',
            'design_options': [],
            'version_action': {'type': 'none'},
            'preference_hints': [],
        }

    created_version_id = None
    created_images = []
    version_action = llm_payload.get('version_action', {})
    action_type = version_action.get('type', 'none')
    enriched_options = []

    if action_type in ('create_version', 'revise_version'):
        parent_version = None
        parent_id = version_action.get('parent_version_id')
        if parent_id:
            parent_version = DesignVersion.objects.filter(
                id=parent_id,
                project=project,
            ).first()
        if parent_version is None:
            parent_version = get_canonical_version(project.id)
        version_notes = version_action.get('notes') or 'Assistant suggested update'
        version = DesignVersion.objects.create(
            project=project,
            parent_version=parent_version,
            notes=version_notes,
        )
        created_version_id = version.id
        for index, option in enumerate(llm_payload.get('design_options', []), start=1):
            prompt = option.get('image_prompt') or option.get('description') or 'Design option'
            image = GeneratedImage.objects.create(
                design_version=version,
                prompt=prompt,
                params_json={'option_index': index},
                image_url=f'https://picsum.photos/seed/{version.id}-{index}/600/400',
            )
            created_images.append(
                {'id': image.id, 'image_url': image.image_url, 'prompt': image.prompt}
            )
            enriched_options.append(
                {
                    'id': f'opt_{index}',
                    'title': option.get('title') or f'Option {index}',
                    'description': option.get('description') or '',
                    'image_prompt': prompt,
                    'image_url': image.image_url,
                }
            )
    else:
        for index, option in enumerate(llm_payload.get('design_options', []), start=1):
            prompt = option.get('image_prompt') or option.get('description') or 'Design option'
            enriched_options.append(
                {
                    'id': f'opt_{index}',
                    'title': option.get('title') or f'Option {index}',
                    'description': option.get('description') or '',
                    'image_prompt': prompt,
                    'image_url': f'https://picsum.photos/seed/{project.id}-{index}/600/400',
                }
            )

    saved_flag = False
    if action_type == 'save_final' or 'save' in message.lower():
        canonical_version = get_canonical_version(project.id)
        if canonical_version is None and created_version_id:
            canonical_version = DesignVersion.objects.filter(
                id=created_version_id,
                project=project,
            ).first()
        FeedbackEvent.objects.create(
            user=request.user,
            project=project,
            design_version=canonical_version,
            event_type='save',
            payload_json={'note': 'saved via chat'},
        )
        saved_flag = True

    assistant_content = llm_payload.get('reply', '')
    assistant_message = ChatMessage.objects.create(
        user=request.user,
        project=project,
        role='assistant',
        content=assistant_content,
        metadata_json={
            'resolved_context': context,
            'version_id': created_version_id,
            'created_images': created_images,
            'design_options': enriched_options,
            'saved': saved_flag,
            'action_type': action_type,
        },
    )

    return Response(
        {
            'assistant_message': assistant_message.content,
            'resolved_context': context,
            'design_options': enriched_options,
            'created_version_id': created_version_id,
            'created_images': created_images,
        }
    )


def _create_demo_images(version, count=5):
    images = []
    for index in range(1, count + 1):
        images.append(
            GeneratedImage.objects.create(
                design_version=version,
                prompt=f'Demo image prompt {index}',
                params_json={'seed': index},
                image_url=f'https://example.com/demo-image-{index}.jpg',
            )
        )
    return images


def _get_or_create_demo_user():
    User = get_user_model()
    user, _ = User.objects.get_or_create(username='sunny')
    UserProfile.objects.get_or_create(user=user, defaults={'display_name': 'Sunny'})
    return user


def _get_or_create_project(user, room_type, title):
    project, _ = Project.objects.get_or_create(
        user=user,
        room_type=room_type,
        title=title,
    )
    return project


def _get_or_create_feedback(user, project, version, event_type, payload_json):
    event, _ = FeedbackEvent.objects.get_or_create(
        user=user,
        project=project,
        design_version=version,
        event_type=event_type,
        payload_json=payload_json,
    )
    process_feedback_event(event)
    return event


@api_view(['POST'])
def demo_seed(request):
    user = request.user
    bedroom = _get_or_create_project(user, 'bedroom', 'Cozy Bedroom')
    living_room = _get_or_create_project(user, 'living_room', 'Living Room')
    office = _get_or_create_project(user, 'office', 'Office')

    v1 = DesignVersion.objects.filter(project=bedroom, version_number=1).first()
    if not v1:
        v1 = DesignVersion.objects.create(project=bedroom, notes='Modern bedroom v1')
        for index in range(1, 6):
            GeneratedImage.objects.create(
                design_version=v1,
                prompt=f'Option {index} modern bedroom',
                params_json={'seed': index},
                image_url=f'https://picsum.photos/seed/{v1.id}-{index}/600/400',
            )

    v2 = DesignVersion.objects.filter(project=bedroom, version_number=2).first()
    if not v2:
        v2 = DesignVersion.objects.create(
            project=bedroom,
            parent_version=v1,
            notes='Warmer update',
        )

    _get_or_create_feedback(
        user,
        bedroom,
        v1,
        'select',
        {'selected_option_index': 3},
    )
    _get_or_create_feedback(
        user,
        bedroom,
        v2,
        'modify',
        {'text': 'make warmer'},
    )
    _get_or_create_feedback(
        user,
        bedroom,
        v2,
        'save',
        {'note': 'final'},
    )

    ChatMessage.objects.get_or_create(
        user=user,
        project=bedroom,
        role='user',
        content='Help me design a modern bedroom',
    )
    ChatMessage.objects.get_or_create(
        user=user,
        project=bedroom,
        role='assistant',
        content='Here are five modern bedroom options.',
        defaults={
            'metadata_json': {
                'design_options': [
                    {
                        'id': f'opt_{index}',
                        'title': f'Option {index}',
                        'description': 'Modern, clean-lined bedroom palette.',
                        'image_prompt': f'Option {index} modern bedroom',
                        'image_url': f'https://picsum.photos/seed/{v1.id}-{index}/640/420',
                    }
                    for index in range(1, 6)
                ],
                'version_id': v1.id,
                'resolved_context': resolve_context(
                    user_id=user.id,
                    message='modern bedroom',
                    project_id=bedroom.id,
                ),
            }
        },
    )
    ChatMessage.objects.get_or_create(
        user=user,
        project=bedroom,
        role='user',
        content='I pick option 3, make it warmer.',
    )
    ChatMessage.objects.get_or_create(
        user=user,
        project=bedroom,
        role='assistant',
        content='Updated with warmer tones and softer lighting.',
        defaults={'metadata_json': {'version_id': v2.id}},
    )
    ChatMessage.objects.get_or_create(
        user=user,
        project=bedroom,
        role='user',
        content='Perfect, save this.',
    )

    return Response(
        {
            'projects': [
                {'id': bedroom.id, 'room_type': bedroom.room_type, 'title': bedroom.title},
                {'id': living_room.id, 'room_type': living_room.room_type, 'title': living_room.title},
                {'id': office.id, 'room_type': office.room_type, 'title': office.title},
            ],
            'bedroom_id': bedroom.id,
            'version_id': v2.id,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
def demo_create_user(request):
    user = _get_or_create_demo_user()
    return Response({'user_id': user.id, 'name': user.username})


@api_view(['POST'])
def demo_seed_projects(request):
    user = request.user

    projects = [
        _get_or_create_project(user, 'bedroom', 'Cozy Bedroom'),
        _get_or_create_project(user, 'living_room', 'Bright Living Room'),
        _get_or_create_project(user, 'office', 'Simple Office'),
    ]
    return Response(
        {
            'projects': [
                {'id': project.id, 'room_type': project.room_type, 'title': project.title}
                for project in projects
            ]
        }
    )


@api_view(['POST'])
def demo_seed_story(request):
    user = request.user

    bedroom = _get_or_create_project(user, 'bedroom', 'Cozy Bedroom')
    living_room = _get_or_create_project(user, 'living_room', 'Bright Living Room')

    version = DesignVersion.objects.filter(project=bedroom, version_number=1).first()
    if not version:
        version = DesignVersion.objects.create(project=bedroom, notes='Initial concept')

    existing_images = GeneratedImage.objects.filter(design_version=version)
    for index in range(existing_images.count() + 1, 6):
        GeneratedImage.objects.create(
            design_version=version,
            prompt=f'Demo image prompt {index}',
            params_json={'seed': index},
            image_url=f'https://picsum.photos/seed/{version.id}-{index}/600/400',
        )

    _get_or_create_feedback(
        user,
        bedroom,
        version,
        'select',
        {'selected_option_index': 3},
    )
    _get_or_create_feedback(
        user,
        bedroom,
        version,
        'modify',
        {'text': 'make warmer'},
    )
    _get_or_create_feedback(
        user,
        bedroom,
        version,
        'save',
        {'note': 'final'},
    )

    preference_keys = list(
        Preference.objects.filter(user=user).values_list('key', flat=True)
    )

    return Response(
        {
            'bedroom_id': bedroom.id,
            'living_room_id': living_room.id,
            'version_id': version.id,
            'preference_keys': preference_keys,
        }
    )


@api_view(['POST'])
def demo_run_step(request):
    step = request.data.get('step')
    user = _get_or_create_demo_user()

    if step in (2, '2'):
        living_room = Project.objects.create(
            user=user,
            room_type='living_room',
            title='Living Room - Same Vibe',
        )
        version = DesignVersion.objects.create(project=living_room, notes='Same vibe as bedroom')
        event = FeedbackEvent.objects.create(
            user=user,
            project=living_room,
            design_version=version,
            event_type='modify',
            payload_json={'text': 'same vibe as bedroom'},
        )
        process_feedback_event(event)
        return Response({'step': 2, 'project_id': living_room.id, 'version_id': version.id})

    if step in (3, '3'):
        bedroom = Project.objects.filter(user=user, room_type='bedroom').order_by('-id').first()
        if not bedroom:
            return Response({'detail': 'Bedroom project not found'}, status=404)
        version = DesignVersion.objects.create(project=bedroom, notes='Add plants')
        event = FeedbackEvent.objects.create(
            user=user,
            project=bedroom,
            design_version=version,
            event_type='modify',
            payload_json={'text': 'add plants'},
        )
        process_feedback_event(event)
        return Response({'step': 3, 'project_id': bedroom.id, 'version_id': version.id})

    if step in (4, '4'):
        office = Project.objects.create(
            user=user,
            room_type='office',
            title='Simple Office',
        )
        version = DesignVersion.objects.create(project=office, notes='Simpler than other rooms')
        event = FeedbackEvent.objects.create(
            user=user,
            project=office,
            design_version=version,
            event_type='modify',
            payload_json={'text': 'simpler than other rooms'},
        )
        process_feedback_event(event)
        return Response({'step': 4, 'project_id': office.id, 'version_id': version.id})

    return Response({'detail': 'Invalid step'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def demo_reset(request):
    user = get_user_model().objects.filter(username='sunny').first()
    if not user:
        return Response({'detail': 'No demo user found'}, status=status.HTTP_404_NOT_FOUND)
    Preference.objects.filter(user=user).delete()
    FeedbackEvent.objects.filter(user=user).delete()
    GeneratedImage.objects.filter(design_version__project__user=user).delete()
    DesignVersion.objects.filter(project__user=user).delete()
    Project.objects.filter(user=user).delete()
    UserProfile.objects.filter(user=user).delete()
    user.delete()
    return Response({'detail': 'Demo data removed'})


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related('user').all()
    serializer_class = UserProfileSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.select_related('user').all()
    serializer_class = ProjectSerializer

    def perform_create(self, serializer):
        project = serializer.save()
        DesignVersion.objects.get_or_create(
            project=project,
            version_number=1,
            defaults={'notes': 'Initial'},
        )
        return project

    def get_queryset(self):
        queryset = super().get_queryset()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset

    @action(detail=True, methods=['get', 'post'], url_path='versions')
    def versions(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            versions = (
                DesignVersion.objects.filter(project=project)
                .order_by('version_number', 'created_at')
            )
            serializer = DesignVersionSerializer(versions, many=True)
            return Response(serializer.data)

        serializer = DesignVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            messages = ChatMessage.objects.filter(project=project).order_by('created_at')
            serializer = ChatMessageSerializer(messages, many=True)
            return Response(serializer.data)

        serializer = ChatMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='previews')
    def previews(self, request):
        projects = Project.objects.filter(user=request.user).order_by('-updated_at')
        latest_messages = (
            ChatMessage.objects.filter(project__in=projects)
            .order_by('project_id', '-created_at')
        )
        previews = {}
        for message in latest_messages:
            if message.project_id not in previews:
                previews[message.project_id] = {
                    'id': message.id,
                    'role': message.role,
                    'content': message.content,
                    'created_at': message.created_at,
                }
        return Response(previews)


class DesignVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DesignVersion.objects.select_related('project').all()
    serializer_class = DesignVersionSerializer

    @action(detail=True, methods=['get', 'post'], url_path='images')
    def images(self, request, pk=None):
        version = self.get_object()
        if request.method == 'GET':
            images = GeneratedImage.objects.filter(design_version=version).order_by('-created_at')
            serializer = GeneratedImageSerializer(images, many=True)
            return Response(serializer.data)

        serializer = GeneratedImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(design_version=version)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FeedbackEventViewSet(viewsets.ModelViewSet):
    queryset = FeedbackEvent.objects.select_related('user', 'project', 'design_version').all()
    serializer_class = FeedbackEventSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        instance = serializer.save()
        process_feedback_event(instance)


class PreferenceViewSet(viewsets.ModelViewSet):
    queryset = Preference.objects.select_related('user').all()
    serializer_class = PreferenceSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset


class ProjectLinkViewSet(viewsets.ModelViewSet):
    queryset = ProjectLink.objects.select_related('from_project', 'to_project').all()
    serializer_class = ProjectLinkSerializer
