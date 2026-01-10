from django.contrib import admin

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

admin.site.register(UserProfile)
admin.site.register(Project)
admin.site.register(ChatMessage)
admin.site.register(DesignVersion)
admin.site.register(GeneratedImage)
admin.site.register(FeedbackEvent)
admin.site.register(Preference)
admin.site.register(ProjectLink)
