from fastapi import FastAPI, HTTPException
from pdf.router import router as pdf_router
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scraper.extractor import extract_job_info
import logging
import asyncio
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Resume Maker API",
    description=(
        "Extracts structured job information from any job listing URL using LangChain + Ollama, "
        "generates ATS-optimized resume bullet points, and compiles them into a PDF via pdflatex."
    ),
    version="2.0.0",
)

# Allow origins from CORS_ORIGINS env var (comma-separated)
_cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────
from auth.router import router as auth_router
from api.routers import router as vault_router

app.include_router(pdf_router)
app.include_router(auth_router)
app.include_router(vault_router)

class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    success: bool
    data: dict | None = None
    error: str | None = None


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "provider": os.getenv("LLM_PROVIDER", "ollama"),
        "model": "llama-3.1-8b-instant" if os.getenv("LLM_PROVIDER", "ollama") == "groq" else "llama3.1:8b",
    }


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_job(request: ScrapeRequest):
    url = request.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    logger.info(f"Scraping: {url}")
    try:
        # Run in a thread so sync Playwright doesn't conflict with asyncio event loop
        job_data = await asyncio.to_thread(extract_job_info, url)
        return ScrapeResponse(success=True, data=job_data)
    except Exception as e:
        logger.error(f"Scraping failed: {e}")
        return ScrapeResponse(success=False, error=str(e))

class ResumeGenerationRequest(BaseModel):
    job_url: str

from ai.llm.ollama_provider import OllamaProvider
from ai.llm.gemma_ollama_provider import GemmaOllamaProvider
from ai.llm.llama_groq_provider import LlamaGroqProvider
from ai.rag.embeddings import OllamaEmbeddings
from ai.rag.vector_store import InMemoryVectorStore
from ai.rag.retriever import RAGRetriever
from ai.pipeline import ResumePipeline


# ── LLM Provider Factory ───────────────────────────────────────────────────
# Set LLM_PROVIDER in your .env to switch providers without changing code.
#
#   LLM_PROVIDER=ollama        → OllamaProvider  (llama3.1:8b, default)
#   LLM_PROVIDER=gemma_ollama  → GemmaOllamaProvider (gemma2:9b via Ollama)
#   LLM_PROVIDER=groq          → LlamaGroqProvider   (llama-3.1-8b-instant via Groq API)
#                                 also requires: GROQ_API_KEY=your_key
#
_provider_name = os.getenv("LLM_PROVIDER", "ollama").lower()

if _provider_name == "groq":
    llm_provider = LlamaGroqProvider()
    logger.info("LLM Provider: Groq (llama-3.1-8b-instant)")
elif _provider_name == "gemma_ollama":
    llm_provider = GemmaOllamaProvider()
    logger.info("LLM Provider: Ollama (gemma2:9b)")
else:
    llm_provider = OllamaProvider(model="llama3.1:8b")
    logger.info("LLM Provider: Ollama (llama3.1:8b)")

embeddings = OllamaEmbeddings(model="nomic-embed-text")
vector_store = InMemoryVectorStore(embeddings)
retriever = RAGRetriever(vector_store)
resume_pipeline = ResumePipeline(llm_provider, retriever)

from auth.dependencies import get_current_user
from fastapi import Depends
from db.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from sqlalchemy.future import select
from db.models import UserExperience, UserProject, UserSkill, UserProfile

@app.post("/generate-resume")
async def generate_resume_endpoint(
    request: ResumeGenerationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    url = request.job_url.strip()
    if not url.startswith(("http://", "https://")):
         raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
         
    logger.info(f"Generating resume for {url}")
    try:
        # Fetch all user vault data
        exps = (await db.execute(select(UserExperience).where(UserExperience.user_id == current_user.id))).scalars().all()
        projs = (await db.execute(select(UserProject).where(UserProject.user_id == current_user.id))).scalars().all()
        skills_rows = (await db.execute(select(UserSkill).where(UserSkill.user_id == current_user.id))).scalars().all()
        profile_row = (await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))).scalars().first()

        # Build candidate profile string
        candidate_profile = ""
        if profile_row:
            candidate_profile = (
                f"Name: {profile_row.first_name or ''} {profile_row.last_name or ''}\n"
                f"Location: {profile_row.location or ''}\n"
                f"Current Summary: {profile_row.summary or 'Not provided.'}"
            )

        # Build structured experience list
        candidate_experiences = [
            {
                "company_name": exp.company_name,
                "job_title": exp.job_title,
                "start_date": str(exp.start_date) if exp.start_date else "",
                "end_date": str(exp.end_date) if exp.end_date else "",
                "raw_description": exp.raw_description or "",
            }
            for exp in exps
        ]

        # Build structured project list
        candidate_projects = [
            {
                "title": proj.title,
                "role": proj.role or "",
                "tech_stack": proj.tech_stack or [],
                "raw_description": proj.raw_description or "",
            }
            for proj in projs
        ]

        # Build flat skills list
        candidate_skills = [
            {"skill_name": s.skill_name, "category": s.category or "Other"}
            for s in skills_rows
        ]

        # Scrape the job description
        job_data = await asyncio.to_thread(extract_job_info, url)
        job_description = (
            f"Title: {job_data.get('title')}\n"
            f"Description:\n{job_data.get('description')}\n"
            f"Requirements:\n{', '.join(job_data.get('requirements', []))}"
        )

        # Run AI Pipeline with full context
        ai_response = await asyncio.to_thread(
            resume_pipeline.generate,
            job_description,
            candidate_skills,
            candidate_profile,
            candidate_experiences,
            candidate_projects,
        )
        logger.info(f"[AI RESPONSE] summary length: {len(ai_response.get('summary', ''))}")
        logger.info(f"[AI RESPONSE] technical_skills count: {len(ai_response.get('technical_skills', []))}")
        logger.info(f"[AI RESPONSE] experiences count: {len(ai_response.get('experiences', []))}")
        logger.info(f"[AI RESPONSE] projects count: {len(ai_response.get('projects', []))}")
        logger.info(f"[AI RESPONSE] full payload: {ai_response}")
        return ai_response
    except Exception as e:
        logger.error(f"Resume generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
