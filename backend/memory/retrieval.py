from typing import Dict, Optional

from .models import DesignVersion, FeedbackEvent, GeneratedImage, Preference, Project


def get_canonical_version(project_id: int) -> Optional[DesignVersion]:
    last_save = (
        FeedbackEvent.objects.filter(
            project_id=project_id,
            event_type='save',
            design_version__isnull=False,
        )
        .order_by('-created_at')
        .first()
    )
    return last_save.design_version if last_save else None


ROOM_ALIASES = {
    'living room': 'living_room',
    'livingroom': 'living_room',
    'bedroom': 'bedroom',
    'kitchen': 'kitchen',
    'bathroom': 'bathroom',
    'office': 'office',
}


def _detect_room_type(message: str) -> Optional[str]:
    lower = (message or '').lower()
    for phrase, room_type in ROOM_ALIASES.items():
        if phrase in lower:
            return room_type
    return None


def _detect_reference_room_type(message: str) -> Optional[str]:
    lower = (message or '').lower()
    for phrase, room_type in ROOM_ALIASES.items():
        if f'same vibe as {phrase}' in lower or f'like {phrase}' in lower:
            return room_type
    return None


def _serialize_project(project: Project) -> Dict:
    return {
        'id': project.id,
        'room_type': project.room_type,
        'title': project.title,
        'created_at': project.created_at.isoformat(),
        'updated_at': project.updated_at.isoformat(),
    }


def _serialize_preference(pref: Preference) -> Dict:
    return {
        'key': pref.key,
        'value': pref.value,
        'confidence': pref.confidence,
        'source': pref.source,
        'updated_at': pref.updated_at.isoformat(),
    }


def _serialize_event(event: FeedbackEvent) -> Dict:
    return {
        'id': event.id,
        'event_type': event.event_type,
        'payload_json': event.payload_json,
        'created_at': event.created_at.isoformat(),
        'design_version_id': event.design_version_id,
    }


def _serialize_image(image: GeneratedImage) -> Dict:
    return {
        'id': image.id,
        'prompt': image.prompt,
        'params_json': image.params_json,
        'image_url': image.image_url,
        'created_at': image.created_at.isoformat(),
    }


def _serialize_version(version: DesignVersion) -> Dict:
    return {
        'id': version.id,
        'version_number': version.version_number,
        'notes': version.notes,
        'created_at': version.created_at.isoformat(),
        'parent_version_id': version.parent_version_id,
    }


def resolve_context(user_id: int, message: str, project_id: Optional[int] = None) -> Dict:
    target_room_type = _detect_room_type(message)
    reference_room_type = _detect_reference_room_type(message)

    target_project = None
    if project_id:
        target_project = (
            Project.objects.filter(id=project_id, user_id=user_id).first()
        )
    if target_room_type and target_project is None:
        target_project = (
            Project.objects.filter(user_id=user_id, room_type=target_room_type)
            .order_by('-updated_at', '-id')
            .first()
        )
    if target_project is None:
        target_project = (
            Project.objects.filter(user_id=user_id)
            .order_by('-updated_at', '-id')
            .first()
        )

    reference_project = None
    if reference_room_type:
        last_saved = (
            FeedbackEvent.objects.filter(
                user_id=user_id,
                event_type='save',
                project__room_type=reference_room_type,
            )
            .order_by('-created_at')
            .first()
        )
        if last_saved:
            reference_project = last_saved.project
        else:
            reference_project = (
                Project.objects.filter(
                    user_id=user_id,
                    room_type=reference_room_type,
                )
                .order_by('-updated_at', '-id')
                .first()
            )

    preferences = list(
        Preference.objects.filter(user_id=user_id)
        .order_by('-confidence', '-updated_at')[:10]
    )

    target_events = []
    if target_project:
        target_events = list(
            FeedbackEvent.objects.filter(project=target_project)
            .order_by('-created_at')[:5]
        )

    reference_summary = None
    if reference_project:
        latest_version = get_canonical_version(reference_project.id)
        if latest_version is None:
            latest_version = (
                DesignVersion.objects.filter(project=reference_project)
                .order_by('-version_number', '-created_at')
                .first()
            )
        images = list(
            GeneratedImage.objects.filter(design_version__project=reference_project)
            .order_by('-created_at')[:3]
        )
        events = list(
            FeedbackEvent.objects.filter(project=reference_project)
            .order_by('-created_at')[:5]
        )
        reference_summary = {
            'project': _serialize_project(reference_project),
            'latest_version': _serialize_version(latest_version) if latest_version else None,
            'recent_images': [_serialize_image(image) for image in images],
            'recent_events': [_serialize_event(event) for event in events],
        }

    return {
        'target_room_type': target_room_type,
        'reference_room_type': reference_room_type,
        'target_project': _serialize_project(target_project) if target_project else None,
        'reference_project': _serialize_project(reference_project) if reference_project else None,
        'preferences': [_serialize_preference(pref) for pref in preferences],
        'reference_summary': reference_summary,
        'target_recent_events': [_serialize_event(event) for event in target_events],
    }
