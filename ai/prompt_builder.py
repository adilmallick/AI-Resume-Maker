from typing import List

class PromptBuilder:
    def build(self, job_description: str, candidate_skills: List[str], matched_keywords: List[str], retrieved_examples: List[str]) -> str:
        examples_text = "\n".join(f"- {ex}" for ex in retrieved_examples)
        
        allowed_skills_text = ", ".join(candidate_skills)
        target_keywords_text = ", ".join(matched_keywords) if matched_keywords else "None"
        
        prompt = f"""
You are an expert resume writer. Generate exactly 4 to 6 ATS-optimized resume bullet points based on the JOB DESCRIPTION.

CANDIDATE'S ALLOWED SKILLS (DO NOT use any technologies not listed here):
{allowed_skills_text}

JOB DESCRIPTION TARGET KEYWORDS (Try to naturally incorporate these if they match the allowed skills):
{target_keywords_text}

RELEVANT EXPERIENCE EXAMPLES:
{examples_text}

Instructions:
- Use the examples as guidance. Do NOT copy them directly.
- Adapt the bullets to the candidate's actual allowed skills.
- Use strong action verbs.
- Include measurable impact (% / scale / metrics).
- You MUST output ONLY valid JSON format. No markdown, no explanations, no additional text.

JSON FORMAT:
{{
  "experience": [
    "Bullet point 1...",
    "Bullet point 2..."
  ]
}}

STRICT RULES:
- Each bullet point must be between 12 and 20 words.
- Total bullet points count must be between 4 and 6.

JOB DESCRIPTION:
{job_description}

Generate JSON now:
"""
        return prompt
