from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scraper.extractor import extract_job_info
import logging
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Job Scraper API",
    description="Extracts structured job information from any job listing URL using LangChain + Ollama (deepseek-coder:1.3b)",
    version="1.0.0",
)

# Allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    success: bool
    data: dict | None = None
    error: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok", "model": "deepseek-coder:1.3b", "provider": "ollama"}


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
    skills: list[str]

from ai.llm.ollama_provider import OllamaProvider
from ai.rag.embeddings import OllamaEmbeddings
from ai.rag.vector_store import InMemoryVectorStore
from ai.rag.retriever import RAGRetriever
from ai.pipeline import ResumePipeline

llm_provider = OllamaProvider(model="deepseek-coder:1.3b")
embeddings = OllamaEmbeddings(model="nomic-embed-text")
vector_store = InMemoryVectorStore(embeddings)
retriever = RAGRetriever(vector_store)
resume_pipeline = ResumePipeline(llm_provider, retriever)

@app.post("/generate-resume")
async def generate_resume_endpoint(request: ResumeGenerationRequest):
    url = request.job_url.strip()
    if not url.startswith(("http://", "https://")):
         raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
         
    logger.info(f"Generating resume for {url}")
    try:
        # First scrape the job using existing scraper
        job_data = await asyncio.to_thread(extract_job_info, url)
        
        job_description = f"Title: {job_data.get('title')}\nDescription:\n{job_data.get('description')}\nRequirements:\n{', '.join(job_data.get('requirements', []))}"
        
        # Run AI Pipeline
        ai_response = await asyncio.to_thread(resume_pipeline.generate, job_description, request.skills)
        return ai_response
    except Exception as e:
        logger.error(f"Resume generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
