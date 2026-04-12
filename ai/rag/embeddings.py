import requests
import logging
from typing import List

logger = logging.getLogger(__name__)

class Embeddings:
    def embed_text(self, text: str) -> List[float]:
        raise NotImplementedError

class OllamaEmbeddings(Embeddings):
    def __init__(self, endpoint: str = "http://localhost:11434/api/embeddings", model: str = "nomic-embed-text"):
        self.endpoint = endpoint
        self.model = model

    def embed_text(self, text: str) -> List[float]:
        try:
            res = requests.post(self.endpoint, json={"model": self.model, "prompt": text}, timeout=30)
            res.raise_for_status()
            return res.json().get("embedding", [])
        except Exception as e:
            logger.error(f"Ollama embedding error: {e}")
            return []
