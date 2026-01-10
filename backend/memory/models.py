from django.conf import settings
from django.db import models, transaction
from django.db.models import Max
from django.utils import timezone


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    display_name = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return self.display_name or self.user.get_username()


class Project(models.Model):
    ROOM_TYPES = [
        ('living_room', 'Living Room'),
        ('bedroom', 'Bedroom'),
        ('kitchen', 'Kitchen'),
        ('bathroom', 'Bathroom'),
        ('office', 'Office'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    room_type = models.CharField(max_length=40, choices=ROOM_TYPES)
    title = models.CharField(max_length=200)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} ({self.get_room_type_display()})'


class DesignVersion(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    version_number = models.PositiveIntegerField()
    parent_version = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='child_versions',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'version_number'],
                name='unique_project_version',
            )
        ]

    def save(self, *args, **kwargs):
        if self.version_number:
            return super().save(*args, **kwargs)

        with transaction.atomic():
            current_max = (
                DesignVersion.objects.select_for_update()
                .filter(project=self.project)
                .aggregate(max_version=Max('version_number'))
            )['max_version']
            self.version_number = (current_max or 0) + 1
            return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.project.title} v{self.version_number}'


class GeneratedImage(models.Model):
    design_version = models.ForeignKey(DesignVersion, on_delete=models.CASCADE)
    prompt = models.TextField()
    params_json = models.JSONField(default=dict, blank=True)
    image_url = models.URLField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    def __str__(self):
        return f'Image for {self.design_version}'


class FeedbackEvent(models.Model):
    EVENT_TYPES = [
        ('select', 'Select'),
        ('reject', 'Reject'),
        ('modify', 'Modify'),
        ('save', 'Save'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    design_version = models.ForeignKey(
        DesignVersion,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    payload_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    def __str__(self):
        return f'{self.user} {self.event_type} {self.project}'


class Preference(models.Model):
    SOURCES = [
        ('explicit', 'Explicit'),
        ('implicit', 'Implicit'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    key = models.CharField(max_length=120)
    value = models.CharField(max_length=255)
    confidence = models.FloatField(default=0.0)
    source = models.CharField(max_length=20, choices=SOURCES)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user} {self.key}={self.value}'


class ProjectLink(models.Model):
    LINK_TYPES = [
        ('similar', 'Similar'),
        ('inspired_by', 'Inspired By'),
        ('reference', 'Reference'),
    ]

    from_project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='outgoing_links',
    )
    to_project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='incoming_links',
    )
    link_type = models.CharField(max_length=40, choices=LINK_TYPES)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    def __str__(self):
        return f'{self.from_project} -> {self.to_project}'


class ChatMessage(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    def __str__(self):
        return f'{self.project.title} {self.role}'
