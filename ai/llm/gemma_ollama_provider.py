import requests
import logging
from ai.interfaces.llm_provider import LLMProvider

logger = logging.getLogger(__name__)


class GemmaOllamaProvider(LLMProvider):
    """
    Ollama provider targeting the gemma2:9b model.
    Requires Ollama running locally with `ollama pull gemma2:9b`.
    """

    def __init__(
        self,
        endpoint: str = "http://localhost:11434/api/generate",
        model: str = "gemma2:9b",
    ):
        self.endpoint = endpoint
        self.model = model

    def generate(self, prompt: str) -> str:
        logger.info("GemmaOllamaProvider: generating with model %s", self.model)
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.0,
                "num_predict": 2048,
                "num_ctx": 8192,   # gemma2 supports larger context
            },
        }
        try:
            response = requests.post(self.endpoint, json=payload, timeout=180)
            response.raise_for_status()
            return response.json().get("response", "")
        except Exception as e:
            logger.error("GemmaOllamaProvider error: %s", e)
            raise RuntimeError(f"Gemma (Ollama) generation failed: {e}")
