import json
import os
import urllib.error
import urllib.request


class ClaudeClient:
    def __init__(self, api_key):
        if not api_key:
            raise ValueError('Anthropic API key is required')
        self.api_key = api_key
        self.model = os.environ.get('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest')

    def generate(self, prompt, max_tokens=800):
        payload = {
            'model': self.model,
            'max_tokens': max_tokens,
            'temperature': 0.3,
            'messages': [{'role': 'user', 'content': prompt}],
        }
        body = json.dumps(payload).encode('utf-8')
        request = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=body,
            method='POST',
        )
        request.add_header('content-type', 'application/json')
        request.add_header('x-api-key', self.api_key)
        request.add_header('anthropic-version', '2023-06-01')

        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f'Anthropic API error: {exc.read().decode("utf-8")}') from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f'Anthropic API connection error: {exc.reason}') from exc

        content = data.get('content', [])
        if not content or 'text' not in content[0]:
            raise RuntimeError('Unexpected Anthropic response format')
        return content[0]['text']
