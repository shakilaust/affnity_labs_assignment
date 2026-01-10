from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DesignVersionViewSet,
    FeedbackEventViewSet,
    PreferenceViewSet,
    ProjectLinkViewSet,
    ProjectViewSet,
    UserProfileViewSet,
    agent_chat,
    assistant_suggest,
    demo_create_user,
    demo_reset,
    demo_run_step,
    demo_seed_projects,
    demo_seed_story,
    demo_seed,
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
    path('agent/chat', agent_chat, name='agent-chat'),
    path('assistant/suggest', assistant_suggest, name='assistant-suggest'),
    path('demo/seed', demo_seed, name='demo-seed'),
    path('demo/run_step', demo_run_step, name='demo-run-step'),
    path('demo/create-user', demo_create_user, name='demo-create-user'),
    path('demo/seed-projects', demo_seed_projects, name='demo-seed-projects'),
    path('demo/seed-story', demo_seed_story, name='demo-seed-story'),
    path('demo/reset', demo_reset, name='demo-reset'),
    path('', include(router.urls)),
    path(
        'projects/link/',
        ProjectLinkViewSet.as_view({'post': 'create'}),
        name='project-link-create',
    ),
]
