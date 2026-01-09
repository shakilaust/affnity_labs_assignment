from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DesignVersionViewSet,
    FeedbackEventViewSet,
    PreferenceViewSet,
    ProjectLinkViewSet,
    ProjectViewSet,
    UserProfileViewSet,
    health,
    resolve_context_view,
)

router = DefaultRouter()
router.register(r'users', UserProfileViewSet, basename='users')
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'versions', DesignVersionViewSet, basename='versions')
router.register(r'feedback', FeedbackEventViewSet, basename='feedback')
router.register(r'preferences', PreferenceViewSet, basename='preferences')

urlpatterns = [
    path('health', health, name='health'),
    path('context/resolve', resolve_context_view, name='context-resolve'),
    path('', include(router.urls)),
    path(
        'projects/link/',
        ProjectLinkViewSet.as_view({'post': 'create'}),
        name='project-link-create',
    ),
]
