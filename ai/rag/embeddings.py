import requests
import logging
import math
from collections import Counter
from typing import List

logger = logging.getLogger(__name__)


class Embeddings:
    def embed_text(self, text: str) -> List[float]:
        raise NotImplementedError


class OllamaEmbeddings(Embeddings):
    """Uses a local Ollama server for embeddings. Only works when Ollama is running."""

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


class HuggingFaceEmbeddings(Embeddings):
    """
    Uses the HuggingFace Inference API (free tier) to generate embeddings.
    Model: sentence-transformers/all-MiniLM-L6-v2 — fast, 384-dim, good quality.

    Requirements:
      - HUGGINGFACE_API_KEY env var (free at huggingface.co → Settings → Access Tokens)
      - No additional pip packages (uses requests, already in requirements.txt)
    """

    HF_API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"

    def __init__(self, api_key: str):
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def embed_text(self, text: str) -> List[float]:
        # Truncate to avoid hitting the model's 256-token limit
        text = text[:1000]
        try:
            res = requests.post(
                self.HF_API_URL,
                headers=self.headers,
                json={"inputs": text, "options": {"wait_for_model": True}},
                timeout=30,
            )
            res.raise_for_status()
            data = res.json()
            # API returns List[float] for single input
            if isinstance(data, list) and data and isinstance(data[0], float):
                return data
            # Sometimes returns List[List[float]] (pooled) — flatten
            if isinstance(data, list) and data and isinstance(data[0], list):
                return data[0]
            logger.warning(f"HuggingFace unexpected response shape: {type(data)}")
            return []
        except Exception as e:
            logger.error(f"HuggingFace embedding error: {e}")
            return []


class KeywordEmbeddings(Embeddings):
    """
    Lightweight, zero-dependency embeddings using TF (term-frequency) bag-of-words.
    No external server required — works in any environment including Render free tier.
    Used as a fallback when no embedding API key is available.
    """

    def __init__(self, vocab_size: int = 512):
        self.vocab_size = vocab_size

    def _tokenize(self, text: str) -> List[str]:
        import re
        return re.findall(r"[a-z0-9]+", text.lower())

    def embed_text(self, text: str) -> List[float]:
        tokens = self._tokenize(text)
        if not tokens:
            return [0.0] * self.vocab_size

        counts = Counter(tokens)
        total = sum(counts.values())

        vec = [0.0] * self.vocab_size
        for token, count in counts.items():
            idx = abs(hash(token)) % self.vocab_size
            vec[idx] += count / total

        # L2-normalise so cosine similarity works correctly
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]

        return vec
