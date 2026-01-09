from typing import List

from .models import FeedbackEvent, Preference


def upsert_preference(user_id, key, value, delta_confidence, source):
    preference, created = Preference.objects.get_or_create(
        user_id=user_id,
        key=key,
        defaults={'value': value, 'confidence': 0.0, 'source': source},
    )
    if not created:
        preference.value = value
        preference.source = source
    preference.confidence = min(1.0, preference.confidence + float(delta_confidence))
    preference.save(update_fields=['value', 'confidence', 'source', 'updated_at'])
    return preference


def _text_contains_any(text, phrases):
    lower = text.lower()
    return any(phrase in lower for phrase in phrases)


def process_feedback_event(event: FeedbackEvent) -> List[Preference]:
    updates = []
    payload = event.payload_json or {}
    text = payload.get('text', '') or ''

    if text:
        if _text_contains_any(text, ['warmer', 'warm tones', 'warm']):
            updates.append(
                upsert_preference(
                    event.user_id,
                    key='tone',
                    value='warm',
                    delta_confidence=0.3,
                    source='explicit',
                )
            )
        if _text_contains_any(text, ['add plants', 'plants', 'greenery']):
            updates.append(
                upsert_preference(
                    event.user_id,
                    key='plants',
                    value='true',
                    delta_confidence=0.3,
                    source='explicit',
                )
            )

    if event.event_type == 'select':
        selected_index = payload.get('selected_option_index')
        if selected_index is not None:
            updates.append(
                upsert_preference(
                    event.user_id,
                    key='favorite_option_index',
                    value=str(selected_index),
                    delta_confidence=0.5,
                    source='implicit',
                )
            )

    return updates
