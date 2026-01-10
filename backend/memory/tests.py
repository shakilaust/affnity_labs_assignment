from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from django.utils import timezone

from .learning import process_feedback_event
from .models import ChatMessage, DesignVersion, FeedbackEvent, Preference, Project
from .retrieval import get_canonical_version, resolve_context


User = get_user_model()


class PreferenceLearningTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='designer')
        self.project = Project.objects.create(
            user=self.user,
            room_type='living_room',
            title='Warm Loft',
        )
        self.version = DesignVersion.objects.create(project=self.project)

    def test_make_warmer_sets_tone(self):
        event = FeedbackEvent.objects.create(
            user=self.user,
            project=self.project,
            design_version=self.version,
            event_type='modify',
            payload_json={'text': 'Please make this warmer.'},
        )
        process_feedback_event(event)
        pref = Preference.objects.get(user=self.user, key='tone')
        self.assertEqual(pref.value, 'warm')
        self.assertGreater(pref.confidence, 0.0)

    def test_add_plants_sets_plants_true(self):
        event = FeedbackEvent.objects.create(
            user=self.user,
            project=self.project,
            design_version=self.version,
            event_type='modify',
            payload_json={'text': 'Can you add plants and greenery?'},
        )
        process_feedback_event(event)
        pref = Preference.objects.get(user=self.user, key='plants')
        self.assertEqual(pref.value, 'true')

    def test_select_option_sets_favorite_index(self):
        event = FeedbackEvent.objects.create(
            user=self.user,
            project=self.project,
            design_version=self.version,
            event_type='select',
            payload_json={'selected_option_index': 3},
        )
        process_feedback_event(event)
        pref = Preference.objects.get(user=self.user, key='favorite_option_index')
        self.assertEqual(pref.value, '3')


class ContextRetrievalTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='planner')
        self.bedroom = Project.objects.create(
            user=self.user,
            room_type='bedroom',
            title='Calm Bedroom',
        )
        self.living_room = Project.objects.create(
            user=self.user,
            room_type='living_room',
            title='Bright Living Room',
        )
        self.version = DesignVersion.objects.create(project=self.bedroom)
        FeedbackEvent.objects.create(
            user=self.user,
            project=self.bedroom,
            design_version=self.version,
            event_type='save',
            payload_json={'note': 'saved'},
        )
        Project.objects.filter(id=self.bedroom.id).update(updated_at=timezone.now())

    def test_cross_room_reference_prefers_bedroom(self):
        payload = resolve_context(
            user_id=self.user.id,
            message='living room same vibe as bedroom',
        )
        self.assertIsNotNone(payload['reference_project'])
        self.assertEqual(payload['reference_project']['id'], self.bedroom.id)


class CanonicalVersionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='canonical')
        self.project = Project.objects.create(
            user=self.user,
            room_type='bedroom',
            title='Canonical Bedroom',
        )
        self.version_one = DesignVersion.objects.create(project=self.project, notes='v1')
        self.version_two = DesignVersion.objects.create(project=self.project, notes='v2')

    def test_get_canonical_version_returns_last_saved(self):
        FeedbackEvent.objects.create(
            user=self.user,
            project=self.project,
            design_version=self.version_one,
            event_type='save',
            payload_json={'note': 'saved v1'},
        )
        FeedbackEvent.objects.create(
            user=self.user,
            project=self.project,
            design_version=self.version_two,
            event_type='save',
            payload_json={'note': 'saved v2'},
        )
        canonical = get_canonical_version(self.project.id)
        self.assertEqual(canonical.id, self.version_two.id)


class AgentChatMetadataTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='agent', password='pass1234')
        self.project = Project.objects.create(
            user=self.user,
            room_type='bedroom',
            title='Agent Bedroom',
        )

    def test_agent_chat_stores_design_options_metadata(self):
        client = APIClient()
        token, _ = Token.objects.get_or_create(user=self.user)
        client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        import os

        os.environ['MOCK_LLM'] = 'true'
        response = client.post(
            '/api/agent/chat',
            {'project_id': self.project.id, 'message': 'Design a modern bedroom'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        message = ChatMessage.objects.filter(project=self.project, role='assistant').last()
        self.assertIsNotNone(message)
        metadata = message.metadata_json
        self.assertIn('design_options', metadata)
        self.assertGreater(len(metadata['design_options']), 0)
        self.assertIn('image_url', metadata['design_options'][0])
