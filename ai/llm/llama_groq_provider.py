import os
import re
import time
import logging
import requests
from ai.interfaces.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class LlamaGroqProvider(LLMProvider):
    """
    Groq provider targeting the llama-3.1-8b-instant model.

    Requires a free Groq API key:
      https://console.groq.com/keys

    Set the key as an environment variable:
      GROQ_API_KEY=your_key_here

    Groq's API is OpenAI-compatible, so the request format follows the
    Chat Completions schema. Automatically retries on 429 rate-limit errors
    using the wait time suggested in the error response.
    """

    MAX_RETRIES = 3

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "llama-3.1-8b-instant",
    ):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY is not set. "
                "Get a free key at https://console.groq.com/keys "
                "and add it to your .env file."
            )
        self.model = model

    @staticmethod
    def _parse_retry_after(error_body: str) -> float:
        """Extract the suggested wait time (seconds) from a Groq 429 response body."""
        match = re.search(r"try again in ([0-9.]+)s", error_body)
        if match:
            return float(match.group(1)) + 0.5  # add a small buffer
        return 5.0  # safe default

    def generate(self, prompt: str) -> str:
        logger.info("LlamaGroqProvider: generating with model %s", self.model)
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
            "max_tokens": 2048,
        }

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                response = requests.post(
                    GROQ_API_URL, headers=headers, json=payload, timeout=60
                )

                if response.status_code == 429:
                    wait = self._parse_retry_after(response.text)
                    logger.warning(
                        "LlamaGroqProvider: rate limited (attempt %d/%d). "
                        "Waiting %.1fs before retry...",
                        attempt, self.MAX_RETRIES, wait
                    )
                    time.sleep(wait)
                    continue  # retry

                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]

            except requests.HTTPError as e:
                logger.error("LlamaGroqProvider HTTP error: %s — %s", e, response.text)
                raise RuntimeError(
                    f"Groq API request failed ({response.status_code}): {response.text}"
                )
            except Exception as e:
                logger.error("LlamaGroqProvider error: %s", e)
                raise RuntimeError(f"Groq generation failed: {e}")

        raise RuntimeError(
            f"Groq rate limit persisted after {self.MAX_RETRIES} retries. "
            "Try again in a minute or upgrade to Groq Dev Tier."
        )

