from django.contrib.auth import get_user_model
from django.test import TestCase

from .learning import process_feedback_event
from .models import DesignVersion, FeedbackEvent, Preference, Project


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
