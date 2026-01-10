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


def build_agent_prompt(context, message):
    prompt_parts = [
        'You are an interior design assistant.',
        'Return JSON only. No markdown or extra text.',
        '',
        'Context:',
        json.dumps(context, ensure_ascii=True),
        '',
        'User message:',
        message,
        '',
        'Output JSON schema:',
        '{',
        '  "reply": "text to show user",',
        '  "design_options": [',
        '    {"title": "...", "description": "...", "image_prompt": "..."}',
        '  ],',
        '  "version_action": {',
        '    "type": "create_version" | "revise_version" | "save_final" | "none",',
        '    "notes": "...",',
        '    "parent_version_id": null',
        '  },',
        '  "preference_hints": [{"key": "tone", "value": "warm"}]',
        '}',
    ]
    return '\n'.join(prompt_parts)
