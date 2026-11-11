from __future__ import annotations

from typing import Dict, Optional

import httpx

from app.config import settings


class AIProvider:
    """Thin OpenAI-compatible wrapper used by the resume optimizer and parser."""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.openai_api_key
        self.base_url = base_url or settings.openai_base_url or "https://api.openai.com/v1"
        self.model = model or settings.openai_model

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = "Bearer " + str(self.api_key)
        return headers

    async def chat_completion(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        if not self.api_key:
            raise RuntimeError("OpenAI API key is not configured.")

        payload = {
            "model": self.model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url.rstrip('/')}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            content = response.json()
            return content["choices"][0]["message"]["content"]
