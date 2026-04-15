import requests
import logging
from ai.interfaces.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

class OllamaProvider(LLMProvider):
    def __init__(self, endpoint: str = "http://localhost:11434/api/generate", model: str = "llama3.1:8b"):
        self.endpoint = endpoint
        self.model = model

    def generate(self, prompt: str) -> str:
        logger.info(f"OllamaProvider: generating response with model {self.model}")
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                 "temperature": 0.0
            }
        }
        try:
            response = requests.post(self.endpoint, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
        except Exception as e:
            logger.error(f"OllamaProvider error: {e}")
            raise RuntimeError(f"Ollama generation failed: {e}")
