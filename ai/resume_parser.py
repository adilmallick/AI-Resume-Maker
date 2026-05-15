from pydantic import BaseModel, Field
from typing import List, Optional, Union, Any
from datetime import date
from langchain_groq import ChatGroq
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import os
import json
import logging

logger = logging.getLogger(__name__)

class ParsedProfile(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None

class ParsedExperience(BaseModel):
    company_name: str
    job_title: str
    location: Optional[str] = None
    start_date: str = Field(description="Format MMM YYYY (e.g., Aug 2019)")
    end_date: Optional[str] = Field(None, description="Format MMM YYYY (e.g., Jun 2023), or leave null if current")
    is_current: bool = False
    raw_description: Optional[str] = Field(None, description="The job description or responsibilities. IMPORTANT: You MUST output this as an HTML unordered list. E.g. '<ul><li>Developed API</li><li>Fixed bugs</li></ul>'. If none, leave null.")

class ParsedSkill(BaseModel):
    skill_name: str
    category: Optional[str] = Field("Other", description="e.g., Frontend, Backend, Tools, Soft Skills")

class ParsedProject(BaseModel):
    title: str
    role: Optional[str] = None
    repository_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    tech_stack: Optional[List[str]] = Field([], description="List of technologies used in the project")
    raw_description: Optional[str] = Field(None, description="The project description. IMPORTANT: You MUST output this as an HTML unordered list. E.g. '<ul><li>Developed API</li><li>Fixed bugs</li></ul>'. If none, leave null.")

class ParsedEducation(BaseModel):
    institution: str
    degree: str
    field_of_study: str
    start_date: str = Field(description="Format MMM YYYY (e.g., Aug 2019)")
    end_date: Optional[str] = Field(None, description="Format MMM YYYY (e.g., Jun 2023)")

class ResumeExtractionSchema(BaseModel):
    profile: ParsedProfile
    experiences: List[ParsedExperience]
    skills: List[ParsedSkill]
    projects: List[ParsedProject]
    educations: List[ParsedEducation]

def _build_extraction_prompt(text: str) -> str:
    """Build the resume extraction prompt string."""
    parser = JsonOutputParser(pydantic_object=ResumeExtractionSchema)
    prompt_template = PromptTemplate(
        template="""You are an expert resume parser. Extract the following information from the provided resume text.
If any field is missing from the resume, leave it as null or empty.
Make sure the output strictly follows the JSON schema provided below.

{format_instructions}

Resume Text:
{text}
""",
        input_variables=["text"],
        partial_variables={"format_instructions": parser.get_format_instructions()},
    )
    return prompt_template.format(text=text)


def _call_provider_directly(prompt: str) -> dict:
    """Call Gemini or Anthropic directly, bypassing LangChain chat model."""
    provider = os.environ.get("LLM_PROVIDER", "ollama").lower()

    if provider == "gemini":
        from ai.llm.gemini_provider import GeminiProvider
        logger.info("Using GeminiProvider for resume parsing")
        raw = GeminiProvider().generate(prompt)
    elif provider == "anthropic":
        from ai.llm.anthropic_provider import AnthropicProvider
        logger.info("Using AnthropicProvider for resume parsing")
        raw = AnthropicProvider(model="claude-3-5-sonnet-20241022").generate(prompt)
    else:
        raise ValueError(f"Unknown provider for direct call: {provider}")

    # Strip markdown code fences if present
    import re
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    result = json.loads(raw)
    return result


def extract_resume_data(text: str) -> ResumeExtractionSchema:
    provider = os.environ.get("LLM_PROVIDER", "ollama").lower()

    # Gemini and Anthropic: call REST APIs directly (avoids LangChain SDK version issues)
    if provider in ("gemini", "anthropic"):
        try:
            logger.info("Starting direct-provider resume extraction pipeline...")
            prompt = _build_extraction_prompt(text)
            result = _call_provider_directly(prompt)
            logger.info("Direct-provider extraction successful.")
            return ResumeExtractionSchema(**result)
        except Exception as e:
            logger.error(f"Error during direct-provider extraction: {e}")
            raise e

    # Groq / Ollama: use LangChain chain
    llm = get_parser_llm()
    parser = JsonOutputParser(pydantic_object=ResumeExtractionSchema)
    prompt_template = PromptTemplate(
        template="""You are an expert resume parser. Extract the following information from the provided resume text.
If any field is missing from the resume, leave it as null or empty.
Make sure the output strictly follows the JSON schema provided below.

{format_instructions}

Resume Text:
{text}
""",
        input_variables=["text"],
        partial_variables={"format_instructions": parser.get_format_instructions()},
    )
    chain = prompt_template | llm | parser

    try:
        logger.info("Starting LLM resume extraction pipeline...")
        result = chain.invoke({"text": text})
        logger.info("LLM extraction successful.")
        return ResumeExtractionSchema(**result)
    except Exception as e:
        logger.error(f"Error during extraction: {e}")
        raise e


def get_parser_llm():
    """Return a LangChain chat model for Groq/Ollama providers."""
    groq_api_key = os.environ.get("GROQ_API_KEY")
    provider = os.environ.get("LLM_PROVIDER", "ollama").lower()

    if groq_api_key and provider == "groq":
        logger.info("Using Groq API for resume parsing")
        return ChatGroq(temperature=0, model_name="llama-3.1-8b-instant", api_key=groq_api_key)
    else:
        logger.info("Using local Ollama for resume parsing")
        return ChatOllama(model="llama3.1:8b", temperature=0, format="json")
