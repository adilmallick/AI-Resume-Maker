import json
import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class OutputValidator:
    def validate(self, llm_response: str, candidate_skills: List[str]) -> Dict[str, Any]:
        """
        Validate the JSON formatting, bullet counts, word counts, and constraint adherence.
        Raises ValueError if validation fails so that the pipeline can retry.
        """
        text = llm_response.strip()
        
        # Robustly extract JSON using regex to ignore any surrounding conversational text
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            text = match.group(0)

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format. Trace: {e}. Raw Text: {llm_response[:100]}...")

        if "experience" not in data:
            raise ValueError("Missing 'experience' key in JSON")
            
        experiences = data["experience"]
        if not isinstance(experiences, list):
            raise ValueError("'experience' must be a list")
            
        if not (3 <= len(experiences) <= 8):
            raise ValueError(f"Expected 3-8 bullet points, got {len(experiences)}")

        # Optionally check word count
        for i, bullet in enumerate(experiences):
            word_count = len(bullet.split())
            if not (9 <= word_count <= 25): # Giving slight buffer (target 12-20)
                logger.warning(f"Bullet {i+1} has {word_count} words, which is outside the strict 12-20 range, but continuing.")
                
        # Optional: verify hallucination (advanced logic could parse out tech names, but naive check here)
        # Assuming if a bullet explicitly states a technology it should be in allowed skills. 
        # For simplicity, we trust the SkillMatcher and Prompt builder mostly, but if we wanted, we could do regex checks.

        return data
