from typing import List, Dict, Any


class PromptBuilder:
    def build(
        self,
        job_description: str,
        candidate_profile: str,
        candidate_skills: List[str],
        candidate_experiences: List[Dict[str, Any]],
        candidate_projects: List[Dict[str, Any]],
        matched_keywords: List[str],
        retrieved_examples: List[str],
    ) -> str:
        examples_text = "\n".join(f"- {ex}" for ex in retrieved_examples) or "None available."
        keywords_text = ", ".join(matched_keywords) if matched_keywords else "None"
        skills_text = ", ".join(candidate_skills) if candidate_skills else "None provided."

        # Format experiences — clearly labeled as RAW SOURCE MATERIAL
        exp_lines = ""
        for exp in candidate_experiences:
            exp_lines += (
                f"  [EXPERIENCE]\n"
                f"  Company: {exp.get('company_name', 'Unknown')}\n"
                f"  Title: {exp.get('job_title', 'Unknown')}\n"
                f"  Dates: {exp.get('start_date', '')} to {exp.get('end_date', '') or 'Present'}\n"
                f"  Raw Notes (DO NOT COPY — use as source of facts only): {exp.get('raw_description', 'No notes provided.')}\n\n"
            )

        # Format projects — clearly labeled as RAW SOURCE MATERIAL
        proj_lines = ""
        for proj in candidate_projects:
            tech = proj.get('tech_stack', [])
            tech_str = ', '.join(tech) if isinstance(tech, list) else str(tech)
            proj_lines += (
                f"  [PROJECT]\n"
                f"  Title: {proj.get('title', 'Unknown')}\n"
                f"  Role: {proj.get('role', 'Contributor')}\n"
                f"  Technologies: {tech_str or 'Not specified'}\n"
                f"  Raw Notes (DO NOT COPY — use as source of facts only): {proj.get('raw_description', 'No notes provided.')}\n\n"
            )

        # JSON skeleton with exact company/project names for key matching
        exp_json_example = ""
        for exp in candidate_experiences:
            company = exp.get('company_name', 'Company')
            exp_json_example += f'    {{"company": "{company}", "bullets": ["<AI-written bullet>", "<AI-written bullet>", "<AI-written bullet>"]}},\n'
        if not exp_json_example:
            exp_json_example = '    {"company": "Company Name", "bullets": ["<AI-written bullet>"]},\n'

        proj_json_example = ""
        for proj in candidate_projects:
            title = proj.get('title', 'Project Title')
            proj_json_example += f'    {{"title": "{title}", "bullets": ["<AI-written bullet>", "<AI-written bullet>"]}},\n'
        if not proj_json_example:
            proj_json_example = '    {"title": "Project Title", "bullets": ["<AI-written bullet>"]},\n'

        prompt = f"""You are a senior technical resume writer and ATS optimization expert.
Your job is to CRAFT original, compelling resume content for a candidate applying to a specific job.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠  CRITICAL RULE — READ BEFORE PROCEEDING:
You MUST write all content from scratch. The "Raw Notes" provided below are
private reminders from the candidate — they are messy, incomplete or informal.
You MUST NOT copy, paraphrase, or rephrase them directly into the output.
Instead, use them only to understand the FACTS (what they worked on, what tools
they used) and then INDEPENDENTLY COMPOSE polished, impactful resume content
aligned to the target job description.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

=== TARGET JOB DESCRIPTION ===
{job_description}

=== JOB KEYWORDS TO TARGET (incorporate naturally if relevant) ===
{keywords_text}

=== CANDIDATE PROFILE ===
{candidate_profile}

=== CANDIDATE'S ALLOWED SKILLS (ONLY use from this list — do NOT invent tools) ===
{skills_text}

=== CANDIDATE WORK EXPERIENCES (RAW SOURCE — rewrite completely, do not copy) ===
{exp_lines or "No work experience provided."}

=== CANDIDATE PROJECTS (RAW SOURCE — rewrite completely, do not copy) ===
{proj_lines or "No projects provided."}

=== STRONG EXAMPLE BULLETS (for style reference only, do NOT copy) ===
{examples_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
=== GENERATION TASKS ===

TASK 1 — "summary":
  Write a 2-3 sentence professional summary CRAFTED for this specific job.
  - Do NOT restate the candidate's existing summary word-for-word.
  - Highlight the most relevant skills and experience that match the job.
  - Sound confident, senior, and specific. Use keywords from the job description.

TASK 2 — "technical_skills":
  Curate the candidate's skills into logical categories for THIS job.
  - Only include skills from the ALLOWED SKILLS list that are RELEVANT to this job.
  - Do NOT include every skill — prioritize what matters most to the employer.
  - Group them into meaningful categories (e.g. Languages, Frameworks, Cloud, Tools).

TASK 3 — "experiences":
  For EACH work experience, write 3-5 bullet points that:
  - START with a STRONG past-tense action verb (Engineered, Architected, Optimized, Delivered...).
  - Include specific IMPACT or METRICS where possible (e.g. "reducing latency by 40%").
  - Incorporate relevant job keywords naturally.
  - Are between 14-22 words each.
  - Sound like a senior engineer wrote them — NOT like the raw notes.
  - DO NOT mention any technology not in the ALLOWED SKILLS list.

TASK 4 — "projects":
  For EACH project, write 2-4 bullet points that:
  - Describe WHAT was built, HOW it was built, and WHY it matters.
  - Use technical vocabulary appropriate for the role.
  - Are between 12-20 words each.
  - Start with a strong action verb.
  - DO NOT copy the raw description text.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
=== REQUIRED OUTPUT FORMAT ===
Output ONLY valid JSON. No markdown fences, no explanations, no preamble.

{{
  "summary": "Crafted 2-3 sentence professional summary targeting this specific job...",
  "technical_skills": [
    {{"category": "Languages", "skills": ["Python", "TypeScript"]}},
    {{"category": "Frameworks", "skills": ["FastAPI", "React"]}},
    {{"category": "Tools", "skills": ["Docker", "Git"]}}
  ],
  "experiences": [
{exp_json_example}  ],
  "projects": [
{proj_json_example}  ]
}}

Generate the JSON now:
"""
        return prompt
