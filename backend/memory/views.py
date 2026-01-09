from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    DesignVersion,
    FeedbackEvent,
    GeneratedImage,
    Preference,
    Project,
    ProjectLink,
    UserProfile,
)
from .learning import process_feedback_event
from .retrieval import resolve_context
from .serializers import (
    DesignVersionSerializer,
    FeedbackEventSerializer,
    GeneratedImageSerializer,
    PreferenceSerializer,
    ProjectLinkSerializer,
    ProjectSerializer,
    UserProfileSerializer,
)


@api_view(['GET'])
def health(request):
    return Response({'status': 'ok'})


@api_view(['POST'])
def resolve_context_view(request):
    user_id = request.data.get('user_id')
    message = request.data.get('message', '')
    if not user_id:
        return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    payload = resolve_context(user_id=user_id, message=message)
    return Response(payload)


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


@api_view(['POST'])
def demo_seed(request):
    user = _get_or_create_demo_user()
    bedroom = Project.objects.create(
        user=user,
        room_type='bedroom',
        title='Cozy Bedroom',
    )
    version = DesignVersion.objects.create(project=bedroom, notes='Initial concept')
    _create_demo_images(version, count=5)

    select_event = FeedbackEvent.objects.create(
        user=user,
        project=bedroom,
        design_version=version,
        event_type='select',
        payload_json={'selected_option_index': 3},
    )
    warm_event = FeedbackEvent.objects.create(
        user=user,
        project=bedroom,
        design_version=version,
        event_type='modify',
        payload_json={'text': 'make warmer'},
    )
    save_event = FeedbackEvent.objects.create(
        user=user,
        project=bedroom,
        design_version=version,
        event_type='save',
        payload_json={'note': 'final'},
    )

    for event in (select_event, warm_event, save_event):
        process_feedback_event(event)

    return Response(
        {
            'user_id': user.id,
            'project_id': bedroom.id,
            'version_id': version.id,
        },
        status=status.HTTP_201_CREATED,
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


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related('user').all()
    serializer_class = UserProfileSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.select_related('user').all()
    serializer_class = ProjectSerializer

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


class DesignVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DesignVersion.objects.select_related('project').all()
    serializer_class = DesignVersionSerializer

    @action(detail=True, methods=['post'], url_path='images')
    def images(self, request, pk=None):
        version = self.get_object()
        serializer = GeneratedImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(design_version=version)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FeedbackEventViewSet(viewsets.ModelViewSet):
    queryset = FeedbackEvent.objects.select_related('user', 'project', 'design_version').all()
    serializer_class = FeedbackEventSerializer

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
