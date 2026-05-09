import httpx
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")
model = os.getenv("DEFAULT_MODEL", "z-ai/glm-4.5-air:free")
url = "https://openrouter.ai/api/v1/chat/completions"

print(f"Testing OpenRouter with model: {model}")

try:
    response = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "X-Title": "ContextBridge-Test"
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": "test"}],
        },
        timeout=30.0
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
