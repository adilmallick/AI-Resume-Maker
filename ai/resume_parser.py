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

def get_parser_llm():
    groq_api_key = os.environ.get("GROQ_API_KEY")
    provider = os.environ.get("LLM_PROVIDER", "ollama").lower()
    
    if groq_api_key and provider == "groq":
        logger.info("Using Groq API for resume parsing")
        return ChatGroq(temperature=0, model_name="llama-3.1-8b-instant", api_key=groq_api_key)
    else:
        logger.info("Using local Ollama for resume parsing")
        # Ensure your local Ollama is running this model
        return ChatOllama(model="llama3.1:8b", temperature=0, format="json")

def extract_resume_data(text: str) -> ResumeExtractionSchema:
    llm = get_parser_llm()
    parser = JsonOutputParser(pydantic_object=ResumeExtractionSchema)
    
    prompt = PromptTemplate(
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
    
    chain = prompt | llm | parser
    
    try:
        logger.info("Starting LLM resume extraction pipeline...")
        result = chain.invoke({"text": text})
        logger.info("LLM extraction successful.")
        return ResumeExtractionSchema(**result)
    except Exception as e:
        logger.error(f"Error during extraction: {e}")
        raise e
