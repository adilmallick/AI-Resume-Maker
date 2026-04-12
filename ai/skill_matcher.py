from typing import List

class SkillMatcher:
    def match(self, candidate_skills: List[str], extracted_keywords: List[str]) -> List[str]:
        """
        Intersect candidate skills and extracted keywords to prevent hallucination.
        Case insensitive matching.
        """
        if not candidate_skills or not extracted_keywords:
            return candidate_skills # default to all candidate skills if nothing to match against

        extracted_lower = set(k.lower() for k in extracted_keywords)
        matched_skills = []
        
        for skill in candidate_skills:
            # If the skill or part of the skill is in the extracted keywords (or vice versa loosely)
            # To be safe and prevent hallucination, we ONLY return candidate skills.
            # The intersection ensures we prioritize candidate skills that are relevant.
            # Since strict intersection might drop too much, we do substring checks.
            s_low = skill.lower()
            is_matched = any(s_low in e or e in s_low for e in extracted_lower)
            if is_matched:
                matched_skills.append(skill)
                
        # Fallback: if intersection is empty, just use original skills to give the LLM something to work with.
        return matched_skills if matched_skills else candidate_skills
