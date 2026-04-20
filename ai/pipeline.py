import logging
from typing import List, Dict, Any
from ai.interfaces.llm_provider import LLMProvider
from ai.rag.retriever import RAGRetriever
from ai.keyword_extractor import KeywordExtractor
from ai.skill_matcher import SkillMatcher
from ai.prompt_builder import PromptBuilder
from ai.validator import OutputValidator

logger = logging.getLogger(__name__)


class ResumePipeline:
    def __init__(self, llm_provider: LLMProvider, retriever: RAGRetriever):
        self.llm = llm_provider
        self.retriever = retriever
        self.extractor = KeywordExtractor(self.llm)
        self.matcher = SkillMatcher()
        self.builder = PromptBuilder()
        self.validator = OutputValidator()

    def generate(
        self,
        job_description: str,
        candidate_skills: List[str],
        candidate_profile: str = "",
        candidate_experiences: List[Dict[str, Any]] = None,
        candidate_projects: List[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        logger.info("ResumePipeline: Starting comprehensive generation process")

        candidate_experiences = candidate_experiences or []
        candidate_projects = candidate_projects or []

        # Flatten skills for keyword matching — handle both raw string list and grouped dicts
        flat_skills: List[str] = []
        for s in candidate_skills:
            if isinstance(s, str):
                flat_skills.append(s)
            elif isinstance(s, dict) and "skill_name" in s:
                flat_skills.append(s["skill_name"])

        # 1. Extract keywords from job description
        keywords = self.extractor.extract(job_description)
        logger.info(f"ResumePipeline: Extracted keywords: {keywords}")

        # 2. Match candidate skills against job keywords
        matched_skills = self.matcher.match(flat_skills, keywords)
        logger.info(f"ResumePipeline: Matched skills: {matched_skills}")

        # 3. Retrieve RAG examples
        examples = self.retriever.retrieve_examples(job_description, flat_skills)
        logger.info(f"ResumePipeline: Retrieved {len(examples)} RAG examples")

        # 4. Build the comprehensive prompt
        prompt = self.builder.build(
            job_description=job_description,
            candidate_profile=candidate_profile,
            candidate_skills=flat_skills,
            candidate_experiences=candidate_experiences,
            candidate_projects=candidate_projects,
            matched_keywords=matched_skills,
            retrieved_examples=examples,
        )

        # 5. LLM Call with retries and progressive fallback
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"ResumePipeline: LLM Generation attempt {attempt + 1}")
                response_text = self.llm.generate(prompt)

                # 6. Validate and structure the response
                validated_data = self.validator.validate(response_text, flat_skills)
                logger.info("ResumePipeline: Success — all sections generated.")
                return validated_data

            except ValueError as e:
                logger.warning(f"ResumePipeline: Validation failed on attempt {attempt + 1}: {e}")
                if attempt == max_retries:
                    logger.error("ResumePipeline: All retries exhausted. Returning safe fallback.")
                    return {
                        "summary": "",
                        "technical_skills": [],
                        "experiences": [],
                        "projects": [],
                        "experience": ["System failed to generate valid ATS content. Please try again."],
                    }

        return {
            "summary": "",
            "technical_skills": [],
            "experiences": [],
            "projects": [],
            "experience": [],
        }
