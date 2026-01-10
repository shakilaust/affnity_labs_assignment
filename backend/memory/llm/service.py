import json
import os

from .clients import ClaudeClient
from .prompting import build_agent_prompt, build_prompt


def _mock_response():
    return {
        'suggestions': [
            {
                'title': 'Warm minimal refresh',
                'notes': 'Add warm wood accents, textured rugs, and soft ambient lighting.',
            }
        ],
        'image_prompts': [
            'Minimal living room with warm wood tones, linen sofa, and soft ambient lighting',
        ],
    }


def _parse_response(text):
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError('LLM response was not valid JSON') from exc

    suggestions = data.get('suggestions', [])
    image_prompts = data.get('image_prompts', [])
    if not isinstance(suggestions, list) or not isinstance(image_prompts, list):
        raise ValueError('LLM response missing required fields')
    return {
        'suggestions': suggestions,
        'image_prompts': image_prompts,
    }


def _mock_agent_response(message):
    return {
        'reply': f'Got it. I will update the plan for: {message}',
        'design_options': [
            {
                'title': 'Warm minimal refresh',
                'description': 'Layer in warm woods, textured textiles, and soft lighting.',
                'image_prompt': 'Warm minimal living room with wood tones and soft lighting',
            },
            {
                'title': 'Plant-forward calm',
                'description': 'Add greenery, linen textures, and muted earthy palette.',
                'image_prompt': 'Calm living room with plants and linen textures',
            },
        ],
        'version_action': {'type': 'create_version', 'notes': 'Draft new design option'},
        'preference_hints': [{'key': 'tone', 'value': 'warm'}],
    }


def _parse_agent_response(text):
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError('LLM response was not valid JSON') from exc

    reply = data.get('reply', '')
    design_options = data.get('design_options', [])
    version_action = data.get('version_action', {'type': 'none'})
    preference_hints = data.get('preference_hints', [])

    if not isinstance(reply, str):
        raise ValueError('LLM response missing reply')
    if not isinstance(design_options, list):
        raise ValueError('LLM response design_options must be a list')
    if not isinstance(version_action, dict):
        raise ValueError('LLM response version_action must be an object')

    action_type = version_action.get('type', 'none')
    if action_type not in ('create_version', 'revise_version', 'save_final', 'none'):
        action_type = 'none'
    version_action['type'] = action_type

    if not isinstance(preference_hints, list):
        preference_hints = []

    return {
        'reply': reply,
        'design_options': design_options,
        'version_action': version_action,
        'preference_hints': preference_hints,
    }


def generate_design_suggestions(context, message, client=None):
    if os.environ.get('MOCK_LLM', 'false').lower() == 'true':
        return _mock_response()

    api_key = os.environ.get('ANTHROPIC_API_KEY')
    prompt = build_prompt(context, message)
    client = client or ClaudeClient(api_key=api_key)
    response_text = client.generate(prompt)
    return _parse_response(response_text)


def generate_agent_response(context, message, client=None):
    if os.environ.get('MOCK_LLM', 'false').lower() == 'true':
        return _mock_agent_response(message)

    api_key = os.environ.get('ANTHROPIC_API_KEY')
    prompt = build_agent_prompt(context, message)
    client = client or ClaudeClient(api_key=api_key)
    response_text = client.generate(prompt)
    return _parse_agent_response(response_text)
