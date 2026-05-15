import os
import requests
import logging
from ai.interfaces.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "gemini-3-flash-preview"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not set. Add it to your .env file.")
        self.model = model

    def generate(self, prompt: str) -> str:
        logger.info("GeminiProvider: generating response with model %s", self.model)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 4096,
            }
        }
        
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except requests.HTTPError as e:
            error_msg = str(e)
            if 'response' in locals() and hasattr(response, 'text'):
                try:
                    error_data = response.json()
                    if "error" in error_data and "message" in error_data["error"]:
                        error_msg = error_data["error"]["message"]
                except Exception:
                    pass
                logger.error("Gemini Response: %s", response.text)
            logger.error("GeminiProvider HTTP error: %s", error_msg)
            raise RuntimeError(error_msg)
        except Exception as e:
            logger.error("GeminiProvider error: %s", e)
            raise RuntimeError(f"Gemini generation failed: {e}")
