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

    def generate(self, job_description: str, candidate_skills: List[str]) -> Dict[str, Any]:
        logger.info("ResumePipeline: Starting generation process")
        
        # 1. Extract keywords
        keywords = self.extractor.extract(job_description)
        logger.info(f"ResumePipeline: Extracted keywords: {keywords}")
        
        # 2. Match skills
        matched_skills = self.matcher.match(candidate_skills, keywords)
        logger.info(f"ResumePipeline: Matched skills: {matched_skills}")
        
        # 3. Retrieve RAG examples
        examples = self.retriever.retrieve_examples(job_description, candidate_skills)
        logger.info(f"ResumePipeline: Retrieved {len(examples)} RAG examples")
        
        # 4. Build prompt
        prompt = self.builder.build(job_description, candidate_skills, matched_skills, examples)
        
        # 5. LLM Call w/ Retries
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"ResumePipeline: LLM Generation attempt {attempt + 1}")
                response_text = self.llm.generate(prompt)
                
                # 6. Validate
                validated_data = self.validator.validate(response_text, candidate_skills)
                logger.info("ResumePipeline: Success")
                return validated_data
            except ValueError as e:
                logger.warning(f"ResumePipeline: Validation failed on attempt {attempt + 1}: {e}")
                if attempt == max_retries:
                    # In a real system, you might want to return a safe fallback.
                    return {"experience": ["System failed to generate valid ATS points. Please try again."]}

        return {"experience": []}
