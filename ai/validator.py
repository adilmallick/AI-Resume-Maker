import json
import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def _clean_llm_json(text: str) -> str:
    """Robustly extract and clean a JSON object from raw LLM output."""
    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    text = re.sub(r'```(?:json)?\s*', '', text)
    text = text.strip()

    # Extract just the JSON object (ignore any preamble/postamble text)
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        text = match.group(0)

    # Fix trailing commas before ] or } (very common LLM output mistake)
    text = re.sub(r',\s*(\]|\})', r'\1', text)

    # Remove control characters that break json.loads
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)

    return text


class OutputValidator:
    def validate(self, llm_response: str, candidate_skills: List[str]) -> Dict[str, Any]:
        """
        Validate the comprehensive JSON response from the LLM.
        Expects keys: summary, technical_skills, experiences, projects.
        Raises ValueError if validation fails so the pipeline can retry.
        """
        text = _clean_llm_json(llm_response)
        logger.info(f"Validator: cleaned JSON snippet (first 400 chars): {text[:400]}")

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format. Trace: {e}. Raw snippet: {llm_response[:300]}...")

        # Ensure all required top-level keys exist with sensible fallbacks
        if "summary" not in data or not isinstance(data["summary"], str):
            logger.warning("Validator: 'summary' key missing or invalid — using fallback.")
            data["summary"] = ""

        if "technical_skills" not in data or not isinstance(data["technical_skills"], list):
            logger.warning("Validator: 'technical_skills' key missing or invalid — using fallback.")
            data["technical_skills"] = []

        if "experiences" not in data or not isinstance(data["experiences"], list):
            logger.warning("Validator: 'experiences' key missing or invalid — using fallback.")
            data["experiences"] = []

        if "projects" not in data or not isinstance(data["projects"], list):
            logger.warning("Validator: 'projects' key missing or invalid — using fallback.")
            data["projects"] = []

        # Validate experience bullets
        for exp in data["experiences"]:
            if "bullets" not in exp or not isinstance(exp["bullets"], list):
                exp["bullets"] = []
            exp["bullets"] = [b for b in exp["bullets"] if isinstance(b, str) and b.strip()]

        # Validate project bullets
        for proj in data["projects"]:
            if "bullets" not in proj or not isinstance(proj["bullets"], list):
                proj["bullets"] = []
            proj["bullets"] = [b for b in proj["bullets"] if isinstance(b, str) and b.strip()]

        # Validate technical skill categories
        validated_skills = []
        for sc in data["technical_skills"]:
            if isinstance(sc, dict) and "category" in sc and "skills" in sc:
                sc["skills"] = [s for s in sc.get("skills", []) if isinstance(s, str) and s.strip()]
                if sc["skills"]:
                    validated_skills.append(sc)
        data["technical_skills"] = validated_skills

        # Keep backward compat: expose a flat "experience" key for legacy code
        if data["experiences"]:
            data["experience"] = data["experiences"][0].get("bullets", [])
        else:
            data["experience"] = []

        return data
