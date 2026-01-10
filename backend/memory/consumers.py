import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from .models import ChatMessage, Project
from .retrieval import resolve_context
from .llm import generate_agent_response

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        params = self.scope['query_string'].decode()
        query = dict(q.split('=') for q in params.split('&') if '=' in q)
        token_key = query.get('token')
        self.project_id = query.get('project_id')
        self.user = await self._get_user(token_key)
        if not self.user:
            await self.close()
            return
        if not await self._project_belongs_to_user(self.project_id, self.user.id):
            await self.close()
            return
        await self.accept()
        await self.send_json({'type': 'connected'})

    async def disconnect(self, close_code):
        return

    async def receive(self, text_data=None, bytes_data=None):
        try:
            payload = json.loads(text_data or '{}')
        except json.JSONDecodeError:
            return
        if payload.get('type') != 'user_message':
            return
        message = payload.get('message', '')
        if not message or not self.project_id:
            return
        await self.send_json({'type': 'thinking'})
        await self._handle_agent_flow(message)

    async def _handle_agent_flow(self, message):
        user = self.user
        project = await self._get_project(self.project_id)
        if not project:
            await self.send_json({'type': 'error', 'detail': 'Project not found'})
            return
        user_chat = await self._create_chat_message(
            user=user,
            project=project,
            role='user',
            content=message,
        )
        context = await database_sync_to_async(resolve_context)(
            user_id=user.id,
            message=message,
            project_id=project.id,
        )
        try:
            llm_payload = await database_sync_to_async(generate_agent_response)(context, message)
        except Exception:
            llm_payload = {
                'reply': 'I hit a snag generating a full response, but I can still help.',
                'design_options': [],
                'version_action': {'type': 'none'},
                'preference_hints': [],
            }

        assistant = await self._create_chat_message(
            user=user,
            project=project,
            role='assistant',
            content=llm_payload.get('reply', ''),
            metadata={
                'design_options': llm_payload.get('design_options', []),
                'resolved_context': context,
                'version_id': None,
            },
        )
        await self.send_json(
            {
                'type': 'assistant_message',
                'message_id': assistant.id,
                'content': assistant.content,
                'metadata_json': assistant.metadata_json,
                'created_at': assistant.created_at.isoformat(),
            }
        )

    async def send_json(self, data):
        await self.send(text_data=json.dumps(data))

    @database_sync_to_async
    def _get_user(self, token_key):
        if not token_key:
            return None
        token = Token.objects.filter(key=token_key).select_related('user').first()
        return token.user if token else None

    @database_sync_to_async
    def _project_belongs_to_user(self, project_id, user_id):
        return Project.objects.filter(id=project_id, user_id=user_id).exists()

    @database_sync_to_async
    def _get_project(self, project_id):
        return Project.objects.filter(id=project_id).first()

    @database_sync_to_async
    def _create_chat_message(self, user, project, role, content, metadata=None):
        return ChatMessage.objects.create(
            user=user,
            project=project,
            role=role,
            content=content,
            metadata_json=metadata or {},
        )
