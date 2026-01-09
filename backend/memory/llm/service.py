import json
import os

from .clients import ClaudeClient
from .prompting import build_prompt


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


def generate_design_suggestions(context, message, client=None):
    if os.environ.get('MOCK_LLM', 'false').lower() == 'true':
        return _mock_response()

    api_key = os.environ.get('ANTHROPIC_API_KEY')
    prompt = build_prompt(context, message)
    client = client or ClaudeClient(api_key=api_key)
    response_text = client.generate(prompt)
    return _parse_response(response_text)
