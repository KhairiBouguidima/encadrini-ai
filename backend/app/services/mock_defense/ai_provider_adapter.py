import json
import re
from typing import Dict, Any, Optional
import requests
from app.core.config import settings

class AIProviderAdapter:
    @classmethod
    async def generate_completion_json(
        cls,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1500,
        temperature: float = 0.4,
        user_api_key: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Sends structured request to LLM (OpenAI, xAI, etc.) expecting JSON output.
        Returns parsed dict or None if API fails / not configured.
        """
        api_key = user_api_key or settings.OPENAI_API_KEY or ""
        if not api_key or api_key in ["sk-fake-key-for-dev", ""]:
            return None

        api_base = "https://api.openai.com/v1"
        model = "gpt-4o-mini"
        if api_key.startswith("xai-"):
            api_base = "https://api.x.ai/v1"
            model = "grok-3-mini"

        try:
            response = requests.post(
                f"{api_base}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "response_format": {"type": "json_object"} if "openai" in api_base else None
                },
                timeout=35,
            )
            if response.status_code == 200:
                raw_content = response.json()["choices"][0]["message"]["content"].strip()
                # Clean possible markdown block
                if raw_content.startswith("```"):
                    raw_content = re.sub(r"^```[a-zA-Z]*\n?", "", raw_content)
                    raw_content = re.sub(r"\n?```$", "", raw_content)
                return json.loads(raw_content)
            else:
                print(f"[ai-adapter] LLM API responded with {response.status_code}: {response.text[:200]}")
        except Exception as e:
            print(f"[ai-adapter] Exception during LLM completion: {e}")

        return None
