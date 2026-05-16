from fastapi import FastAPI, HTTPException
from pdf.router import router as pdf_router
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scraper.extractor import extract_job_info, extract_from_text
import logging
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

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
# Admin panel origins are always allowed so the standalone admin panel can call the API
# Set ALLOW_ALL_ORIGINS=true in dev to bypass CORS entirely (e.g. when opening admin panel as file://)
_allow_all = os.getenv("ALLOW_ALL_ORIGINS", "false").lower() == "true"
_cors_origins_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500,http://localhost:5173"
)
_cors_origins = ["*"] if _allow_all else [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not _allow_all,  # credentials + wildcard is not allowed by spec
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ────────────────────────────────────────────────────────────────
from auth.router import router as auth_router
from api.routers import router as vault_router
from api.resume_upload import router as resume_upload_router
from api.admin import router as admin_router

app.include_router(pdf_router)
app.include_router(auth_router)
app.include_router(vault_router)
app.include_router(resume_upload_router)
app.include_router(admin_router)

# ── Startup: sync provider from DB ─────────────────────────────────────────
from db.database import AsyncSessionLocal

@app.on_event("startup")
async def _on_startup():
    """Load the active LLM provider from system_config on server start."""
    async with AsyncSessionLocal() as db:
        await app_state.load_from_db(db)
    logger.info(f"[Startup] Active LLM provider: {app_state.provider_name}")



class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    success: bool
    data: dict | None = None
    error: str | None = None


@app.get("/health")
async def health():
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    if provider == "groq":
        model = "llama-3.1-8b-instant"
    elif provider == "gemma_ollama":
        model = "gemma2:9b"
    elif provider == "gemini":
        model = "gemini-3.1-pro"
    elif provider == "anthropic":
        model = "claude-4-sonnet"
    else:
        model = "llama3.1:8b"
        
    return {
        "status": "ok",
        "provider": provider,
        "model": model,
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
    job_url: str | None = None
    job_text: str | None = None

class ATSScoreRequest(BaseModel):
    job_input: str
    resume_data: dict

# ── App State (mutable LLM provider + pipeline) ───────────────────────────
# Import the singleton — provider can be hot-swapped at runtime via /admin/config
from app_state import state as app_state
logger.info(f"LLM Provider (startup): {app_state.provider_name}")

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
    if not request.job_url and not request.job_text:
         raise HTTPException(status_code=400, detail="Must provide either job_url or job_text")
         
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

        # Get the job description
        job_description = ""
        job_data = None
        
        if request.job_text:
            try:
                job_data = await asyncio.to_thread(extract_from_text, request.job_text)
                job_description = (
                    f"Title: {job_data.get('title')}\n"
                    f"Description:\n{job_data.get('description')}\n"
                    f"Requirements:\n{', '.join(job_data.get('requirements', []))}"
                )
            except Exception as e:
                logger.error(f"Failed to extract from job text: {e}")
                job_description = request.job_text
        else:
            url = request.job_url.strip()
            if not url.startswith(("http://", "https://")):
                 raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
            
            logger.info(f"Generating resume for {url}")
            try:
                job_data = await asyncio.to_thread(extract_job_info, url)
                job_description = (
                    f"Title: {job_data.get('title')}\n"
                    f"Description:\n{job_data.get('description')}\n"
                    f"Requirements:\n{', '.join(job_data.get('requirements', []))}"
                )
            except Exception as e:
                logger.error(f"Failed to scrape job URL: {e}")
                raise HTTPException(status_code=400, detail="Bot prevention blocked scraping. Please paste the raw job description instead.")

        # Run AI Pipeline with full context
        ai_response = await asyncio.to_thread(
            app_state.pipeline.generate,
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
        
        ai_response["job_description"] = job_description
        ai_response["job_data"] = job_data
        
        logger.info(f"[AI RESPONSE] full payload: {ai_response}")
        return ai_response
    except Exception as e:
        logger.error(f"Resume generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from ai.ats_scorer import ATSScorer

@app.post("/api/ats/score")
async def ats_score_endpoint(
    request: ATSScoreRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        job_description = request.job_input
        if request.job_input.startswith(("http://", "https://")):
            job_data = await asyncio.to_thread(extract_job_info, request.job_input)
            job_description = (
                f"Title: {job_data.get('title')}\n"
                f"Description:\n{job_data.get('description')}\n"
                f"Requirements:\n{', '.join(job_data.get('requirements', []))}"
            )
        
        scorer = ATSScorer(keyword_extractor=app_state.pipeline.extractor)
        result = await asyncio.to_thread(scorer.score, request.resume_data, job_description)
        return result
    except Exception as e:
        logger.error(f"ATS Score failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
