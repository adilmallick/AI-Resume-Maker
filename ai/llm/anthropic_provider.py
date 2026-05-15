import os
import requests
import logging
from ai.interfaces.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "claude-4-sonnet"):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set. Add it to your .env file.")
        self.model = model

    def generate(self, prompt: str) -> str:
        logger.info("AnthropicProvider: generating response with model %s", self.model)
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "temperature": 0.0,
            "messages": [{"role": "user", "content": prompt}]
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
        except requests.HTTPError as e:
            error_msg = str(e)
            if 'response' in locals() and hasattr(response, 'text'):
                try:
                    error_data = response.json()
                    if "error" in error_data and "message" in error_data["error"]:
                        error_msg = error_data["error"]["message"]
                except Exception:
                    pass
                logger.error("Anthropic Response: %s", response.text)
            logger.error("AnthropicProvider HTTP error: %s", error_msg)
            raise RuntimeError(error_msg)
        except Exception as e:
            logger.error("AnthropicProvider error: %s", e)
            raise RuntimeError(f"Anthropic generation failed: {e}")
