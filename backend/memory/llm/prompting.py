import json


def build_prompt(context, message):
    preferences = context.get('preferences', [])
    reference_summary = context.get('reference_summary')
    target_project = context.get('target_project')

    prompt_parts = [
        'You are an interior design assistant.',
        'Return JSON only. No markdown or extra text.',
        '',
        'Preferences:',
        json.dumps(preferences, ensure_ascii=True),
        '',
        'Target project:',
        json.dumps(target_project, ensure_ascii=True),
        '',
        'Reference project summary:',
        json.dumps(reference_summary, ensure_ascii=True),
        '',
        'Requested change:',
        message,
        '',
        'Output JSON format:',
        '{',
        '  "suggestions": [',
        '    {"title": "string", "notes": "string"}',
        '  ],',
        '  "image_prompts": ["string"]',
        '}',
    ]
    return '\n'.join(prompt_parts)
