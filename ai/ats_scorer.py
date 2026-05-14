import re
from typing import List, Dict, Any
from dataclasses import dataclass
from ai.keyword_extractor import KeywordExtractor

@dataclass
class ATSResult:
    overall_score: int
    keyword_score: int
    skill_score: int
    title_score: int
    completeness_score: int
    matched_keywords: List[str]
    missing_keywords: List[str]
    tips: List[str]
    suggested_titles: List[str]

class ATSScorer:
    def __init__(self, keyword_extractor: KeywordExtractor = None):
        self.extractor = keyword_extractor

    def score(self, staged_data: Dict[str, Any], job_description: str) -> ATSResult:
        # Extract keywords from JD using LLM (if provided) or fallback to naive extraction
        required_keywords = []
        if self.extractor:
            required_keywords = self.extractor.extract(job_description)
        else:
            # Naive fallback if no LLM provided (just an example, ideally we pass the LLM)
            words = set(re.findall(r'\b[a-zA-Z]{3,}\b', job_description.lower()))
            # This is too noisy, we should really rely on the LLM extractor
            pass 
        
        # If extraction failed or returned nothing
        if not required_keywords:
            return ATSResult(0, 0, 0, 0, 0, [], [], ["Could not extract keywords from Job Description."], [])

        req_lower = [k.lower() for k in required_keywords]
        
        # 1. Build Candidate Corpus
        # Combine skills, experience bullets, project descriptions, summary
        profile = staged_data.get("profile") or {}
        summary = profile.get("summary", "")
        
        skills_data = staged_data.get("skills") or []
        flat_skills = []
        for cat in skills_data:
            if isinstance(cat, dict) and "skills" in cat:
                flat_skills.extend(cat["skills"])
            elif isinstance(cat, str):
                flat_skills.append(cat)
        
        experiences = staged_data.get("experiences") or []
        exp_text = []
        job_titles = []
        for exp in experiences:
            job_titles.append(exp.get("job_title", "").lower())
            bullets = exp.get("stagedBullets") or exp.get("bullets") or []
            if isinstance(bullets, list):
                exp_text.extend(bullets)
            elif isinstance(bullets, str):
                exp_text.append(bullets)
        
        projects = staged_data.get("projects") or []
        proj_text = []
        for proj in projects:
            bullets = proj.get("stagedBullets") or proj.get("bullets") or []
            if isinstance(bullets, list):
                proj_text.extend(bullets)
            elif isinstance(bullets, str):
                proj_text.append(bullets)
        
        # Combine all searchable text
        corpus_parts = [summary] + flat_skills + exp_text + proj_text
        corpus_text = " ".join(corpus_parts).lower()
        
        # 2. Keyword Match (40%)
        matched_keywords = []
        missing_keywords = []
        for k in required_keywords:
            if k.lower() in corpus_text:
                matched_keywords.append(k)
            else:
                missing_keywords.append(k)
        
        keyword_score = 0
        if required_keywords:
            keyword_score = int((len(matched_keywords) / len(required_keywords)) * 100)
            
        # 3. Skills Coverage (25%)
        # How many of the extracted keywords match the candidate's explicit skills list?
        # A keyword is matched if it's in the skills list
        skills_text = " ".join(flat_skills).lower()
        matched_skills = [k for k in required_keywords if k.lower() in skills_text]
        skill_score = 0
        if required_keywords:
            skill_score = int((len(matched_skills) / len(required_keywords)) * 100)

        # 4. Title Alignment (15%) + Title Suggestions
        # Try to extract the job title from the JD ("Title: X" pattern used by the pipeline)
        suggested_titles = []
        jd_title_raw = ""
        for line in job_description.strip().splitlines()[:5]:
            line = line.strip()
            if line.lower().startswith("title:"):
                jd_title_raw = line[6:].strip()
                break
        # Fallback: use the first non-empty line
        if not jd_title_raw:
            for line in job_description.strip().splitlines():
                if line.strip():
                    jd_title_raw = line.strip()
                    break

        if jd_title_raw:
            exact = jd_title_raw
            suggested_titles.append(exact)
            # Strip common seniority prefixes to offer a base variant
            for prefix in ("senior ", "junior ", "lead ", "principal ", "staff ", "associate "):
                if exact.lower().startswith(prefix):
                    suggested_titles.append(exact[len(prefix):].strip().title())
                    break
            # Offer seniority-prefixed variant if none was present
            if len(suggested_titles) == 1:
                suggested_titles.append(f"Senior {exact}")

        jd_title_section = job_description[:300].lower()
        title_score = 0
        
        # Check if any suggested title is explicitly in the summary
        summary_lower = summary.lower()
        for s_title in suggested_titles:
            if s_title and s_title.lower() in summary_lower:
                title_score = 100
                break

        if title_score == 0:
            for title in job_titles:
                if title and title in jd_title_section:
                    title_score = 100
                    break
        
        if title_score == 0 and job_titles:
            # Partial match
            for title in job_titles:
                parts = title.split()
                if any(p in jd_title_section for p in parts if len(p) > 3):
                    title_score = 50
                    break
        
        # 5. Completeness (20%)
        comp_score = 0
        if summary.strip(): comp_score += 20
        if experiences: comp_score += 30
        if projects: comp_score += 20
        if flat_skills: comp_score += 20
        educations = staged_data.get("educations", [])
        if educations: comp_score += 10
        completeness_score = min(100, comp_score)
        
        # 6. Overall Score
        overall = (
            (keyword_score * 0.40) +
            (skill_score * 0.25) +
            (title_score * 0.15) +
            (completeness_score * 0.20)
        )
        overall_score = int(overall)
        
        # 7. Generate Tips
        tips = []
        if completeness_score < 100:
            if not summary.strip(): tips.append("Add a professional summary.")
            if not projects: tips.append("Add projects to showcase your practical experience.")
            if not educations: tips.append("Add your education details.")
        
        if keyword_score < 70:
            tips.append(f"Try incorporating these keywords into your experience bullets: {', '.join(missing_keywords[:3])}")
            
        if title_score == 0:
            tips.append("Consider aligning your job titles slightly to match the target role if applicable.")
            
        if skill_score < 50:
            tips.append("Add more explicitly required skills to your Skills section.")
            
        if not tips:
            tips.append("Your resume is well optimized for this job description!")

        return ATSResult(
            overall_score=overall_score,
            keyword_score=keyword_score,
            skill_score=skill_score,
            title_score=title_score,
            completeness_score=completeness_score,
            matched_keywords=matched_keywords,
            missing_keywords=missing_keywords,
            tips=tips,
            suggested_titles=suggested_titles
        )
