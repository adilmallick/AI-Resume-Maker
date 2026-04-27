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
        # Sort by end_date descending to ensure the most recent experience gets the most bullet points
        candidate_experiences = sorted(
            candidate_experiences,
            key=lambda x: x.get('end_date') or '9999-12-31',
            reverse=True
        )

        examples_text = "\n".join(f"- {ex}" for ex in retrieved_examples) or "None available."
        keywords_text = ", ".join(matched_keywords) if matched_keywords else "None"
        skills_text = ", ".join(candidate_skills) if candidate_skills else "None provided."

        num_exps = len(candidate_experiences)
        num_projs = len(candidate_projects)
        total_sub_sections = num_exps + num_projs

        # Budget calculation
        total_available_bullets = max(2, 20 - (2 * total_sub_sections))

        # Weight calculation
        exp_weights = [3.0 / (i + 1) for i in range(num_exps)]
        proj_weights = [1.5 / (j + 1) for j in range(num_projs)]
        total_weight = sum(exp_weights) + sum(proj_weights)

        # Distribute targets for Experiences
        exp_targets = []
        actual_used_by_exps = 0
        expected_used_by_exps = 0
        for i, weight in enumerate(exp_weights):
            raw_target = round(total_available_bullets * (weight / total_weight)) if total_weight > 0 else 0
            expected_used_by_exps += raw_target
            max_cap = 7 if i == 0 else 6
            target = max(2, min(raw_target, max_cap))
            exp_targets.append(target)
            actual_used_by_exps += target

        # Calculate rollover for Projects
        rollover = max(0, expected_used_by_exps - actual_used_by_exps)
        proj_targets = []
        for j, weight in enumerate(proj_weights):
            raw_target = round(total_available_bullets * (weight / total_weight)) if total_weight > 0 else 0
            if j == 0:
                raw_target += rollover
            target = max(2, min(raw_target, 6))
            proj_targets.append(target)

        # Format experiences
        exp_lines = ""
        exp_json_example = ""
        for i, exp in enumerate(candidate_experiences):
            target_bullets = exp_targets[i]
            exp_lines += (
                f"  [EXPERIENCE {i+1}]\n"
                f"  Company: {exp.get('company_name', 'Unknown')}\n"
                f"  Title: {exp.get('job_title', 'Unknown')}\n"
                f"  Dates: {exp.get('start_date', '')} to {exp.get('end_date', '') or 'Present'}\n"
                f"  TARGET BULLET COUNT: {target_bullets} bullet points\n"
                f"  Raw Notes (DO NOT COPY — use as source of facts only): {exp.get('raw_description', 'No notes provided.')}\n\n"
            )
            company = exp.get('company_name', 'Company')
            bullets_arr = ", ".join(['"<AI-written bullet>"'] * target_bullets)
            exp_json_example += f'    {{"company": "{company}", "bullets": [{bullets_arr}]}},\n'

        if not exp_json_example:
            exp_json_example = '    {"company": "Company Name", "bullets": ["<AI-written bullet>"]},\n'

        # Format projects
        proj_lines = ""
        proj_json_example = ""
        for j, proj in enumerate(candidate_projects):
            target_bullets = proj_targets[j]
            tech = proj.get('tech_stack', [])
            tech_str = ', '.join(tech) if isinstance(tech, list) else str(tech)
            proj_lines += (
                f"  [PROJECT {j+1}]\n"
                f"  Title: {proj.get('title', 'Unknown')}\n"
                f"  Role: {proj.get('role', 'Contributor')}\n"
                f"  Technologies: {tech_str or 'Not specified'}\n"
                f"  TARGET BULLET COUNT: {target_bullets} bullet points\n"
                f"  Raw Notes (DO NOT COPY — use as source of facts only): {proj.get('raw_description', 'No notes provided.')}\n\n"
            )
            title = proj.get('title', 'Project Title')
            bullets_arr = ", ".join(['"<AI-written bullet>"'] * target_bullets)
            proj_json_example += f'    {{"title": "{title}", "bullets": [{bullets_arr}]}},\n'

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
  Write a 2-3 sentence, highly impactful professional summary CRAFTED for this specific job.
  - Do NOT restate the candidate's existing summary word-for-word.
  - Detail their deep expertise, most prominent achievements, and direct alignment with the role.
  - Sound confident, senior, and specific. Use keywords from the job description.

TASK 2 — "technical_skills":
  Curate the candidate's skills into logical categories for THIS job.
  - Only include skills from the ALLOWED SKILLS list that are RELEVANT to this job.
  - Do NOT include every skill — prioritize what matters most to the employer.
  - Group them into meaningful categories (e.g. Languages, Frameworks, Cloud, Tools).

TASK 3 — "experiences":
  For EACH work experience, write the requested number of highly detailed bullet points (see TARGET BULLET COUNT under each experience) that:
  - START with a STRONG past-tense action verb (Engineered, Architected, Optimized, Delivered...).
  - Highlight extensive context, the exact technologies used, and the business impact.
  - Include specific IMPACT or METRICS where possible. Key achievements (with metrics) make impact instantly visible (e.g. "Improved API response time by 40%, reducing latency from 500ms to 300ms", "Increased user retention by 25% using personalized recommendations").
  - IMPORTANT: Highlight key technical skills, tools, and metrics by wrapping them in HTML bold tags (e.g., "built with <b>AWS</b>", "reduced latency by <b>40%</b>").
  - Incorporate relevant job keywords naturally.
  - MUST be dense and comprehensive, between 25-45 words each.
  - Sound like a principal/senior engineer wrote them.
  - DO NOT mention any technology not in the ALLOWED SKILLS list.

TASK 4 — "projects":
  For EACH project, write the requested number of highly detailed bullet points (see TARGET BULLET COUNT under each project) that:
  - Deeply describe WHAT was built, HOW it was built, the architecture, and WHY it matters.
  - Use extensive technical vocabulary appropriate for the role.
  - IMPORTANT: Wrap all technical frameworks, languages, and key metrics in HTML bold tags (e.g., <b>React</b>, <b>Node.js</b>).
  - MUST be between 20-35 words each.
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
