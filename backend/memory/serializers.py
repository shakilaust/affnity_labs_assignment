from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    DesignVersion,
    FeedbackEvent,
    GeneratedImage,
    Preference,
    Project,
    ProjectLink,
    UserProfile,
)

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'display_name', 'username', 'email']
        read_only_fields = ['id', 'user']

    def create(self, validated_data):
        username = validated_data.pop('username')
        email = validated_data.pop('email', '')
        user = User.objects.create(username=username, email=email)
        profile = UserProfile.objects.create(user=user, **validated_data)
        return profile

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['username'] = instance.user.username
        data['email'] = instance.user.email
        return data


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'user', 'room_type', 'title', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DesignVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignVersion
        fields = ['id', 'project', 'version_number', 'parent_version', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at', 'version_number', 'project']


class GeneratedImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeneratedImage
        fields = ['id', 'design_version', 'prompt', 'params_json', 'image_url', 'created_at']
        read_only_fields = ['id', 'created_at', 'design_version']


class FeedbackEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackEvent
        fields = [
            'id',
            'user',
            'project',
            'design_version',
            'event_type',
            'payload_json',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Preference
        fields = ['id', 'user', 'key', 'value', 'confidence', 'source', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class ProjectLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectLink
        fields = ['id', 'from_project', 'to_project', 'link_type', 'reason', 'created_at']
        read_only_fields = ['id', 'created_at']
