import json
import logging
from typing import List
from ai.interfaces.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

class KeywordExtractor:
    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider

    def extract(self, job_description: str) -> List[str]:
        prompt = f"""
Extract exactly 10-15 key technologies, frameworks, and prominent job responsibilities from the following job description.
Return ONLY a raw JSON list of strings. Do not use markdown blocks, do not wrap in ```json, and output ONLY the list.

JOB DESCRIPTION:
{job_description}

JSON LIST FORMAT:
["Skill1", "Skill2", ...]
"""
        logger.info("KeywordExtractor: extracting keywords...")
        raw_response = self.llm.generate(prompt)
        try:
            # Cleanup common LLM formatting
            text = raw_response.strip()
            if text.startswith("```json"): text = text[7:]
            if text.startswith("```"): text = text[3:]
            if text.endswith("```"): text = text[:-3]
            
            keywords = json.loads(text)
            if isinstance(keywords, list):
                return keywords
            return []
        except Exception as e:
            logger.warning(f"Keyword extraction failed to parse JSON: {e}")
            return []
