from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    DesignVersion,
    FeedbackEvent,
    Preference,
    Project,
    ProjectLink,
    UserProfile,
)
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
