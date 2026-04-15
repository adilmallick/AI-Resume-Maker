"""
pdf/router.py
─────────────
FastAPI router exposing the ``POST /generate-resume-pdf`` endpoint.

Separation of concerns
───────────────────────
* **Router** — HTTP contract only: parse request, delegate, stream response.
* **Sanitizer** — LaTeX-escapes every string from user / AI.
* **TemplateEngine** — Injects sanitized data into the static template.
* **Generator** — Spawns pdflatex and returns raw PDF bytes.

No business logic lives in this file.
"""

import asyncio
import io
import logging
import subprocess
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from pdf.generator import CompilationError, compile_latex
from pdf.sanitizer import sanitize, sanitize_bullet_list
from pdf.template_engine import TemplateNotFoundError, render_template

logger = logging.getLogger(__name__)

router = APIRouter(tags=["PDF Generation"])


# ── Request / Response schemas ─────────────────────────────────────────────

class ResumePDFRequest(BaseModel):
    """
    Structured resume data supplied by the AI pipeline.

    Every field is individually sanitized before template injection.
    The ``bullets`` list becomes the ``EXPERIENCE_POINTS`` block.
    """

    bullets: list[str] = Field(
        ...,
        min_length=1,
        description="ATS-optimized resume experience bullet points.",
        examples=[["Led team of 5 engineers", "Reduced latency by 40%"]],
    )

    # Optional header fields — sensible defaults keep the template valid
    # even when the AI only supplies bullet points.
    candidate_name: str = Field(default="Candidate Name")
    candidate_email: str = Field(default="candidate@example.com")
    candidate_phone: str = Field(default="+1 (555) 000-0000")
    candidate_location: str = Field(default="City, State")
    summary: str = Field(
        default="Experienced professional seeking new opportunities."
    )
    job_title: str = Field(default="Software Engineer")
    job_date_range: str = Field(default="Jan 2023 – Present")
    company_name: str = Field(default="Tech Company")
    job_location: str = Field(default="Remote")
    skills_list: str = Field(default="Python, FastAPI, Docker")
    degree: str = Field(default="Bachelor of Science in Computer Science")
    education_date_range: str = Field(default="2018 – 2022")
    institution: str = Field(default="University Name")

    @field_validator("bullets")
    @classmethod
    def bullets_must_be_non_empty_strings(cls, v: list[str]) -> list[str]:
        cleaned = [b.strip() for b in v if isinstance(b, str) and b.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty bullet point is required.")
        return cleaned


# ── Endpoint ───────────────────────────────────────────────────────────────

@router.post(
    "/generate-resume-pdf",
    summary="Generate a resume PDF from AI-produced bullet points",
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "Compiled PDF document.",
        },
        500: {"description": "LaTeX compilation error or missing pdflatex binary."},
    },
)
async def generate_resume_pdf(request: ResumePDFRequest) -> StreamingResponse:
    """
    Accept structured resume data, inject it into the static LaTeX template,
    compile to PDF with pdflatex, and return a streaming ``application/pdf``
    response.

    The LLM **never** writes LaTeX — only sanitized plaintext values are
    substituted into the predefined template placeholders.
    """
    logger.info(
        "PDF generation requested — %d bullet(s)", len(request.bullets)
    )

    # ── 1. Sanitize every field ────────────────────────────────────────────
    data = {
        "CANDIDATE_NAME":     sanitize(request.candidate_name),
        "CANDIDATE_EMAIL":    sanitize(request.candidate_email),
        "CANDIDATE_PHONE":    sanitize(request.candidate_phone),
        "CANDIDATE_LOCATION": sanitize(request.candidate_location),
        "SUMMARY":            sanitize(request.summary),
        "JOB_TITLE":          sanitize(request.job_title),
        "JOB_DATE_RANGE":     sanitize(request.job_date_range),
        "COMPANY_NAME":       sanitize(request.company_name),
        "JOB_LOCATION":       sanitize(request.job_location),
        # Bullet list gets its own sanitize+format helper
        "EXPERIENCE_POINTS":  sanitize_bullet_list(request.bullets),
        "SKILLS_LIST":        sanitize(request.skills_list),
        "DEGREE":             sanitize(request.degree),
        "EDUCATION_DATE_RANGE": sanitize(request.education_date_range),
        "INSTITUTION":        sanitize(request.institution),
    }

    # ── 2. Render template ─────────────────────────────────────────────────
    try:
        latex_source = render_template(data)
    except TemplateNotFoundError as exc:
        logger.error("LaTeX template missing: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Server configuration error: LaTeX template not found.",
        ) from exc

    # ── 3. Compile PDF (offloaded from async event loop) ──────────────────
    try:
        pdf_bytes: bytes = await asyncio.to_thread(compile_latex, latex_source)
    except FileNotFoundError as exc:
        # pdflatex not installed
        logger.error("pdflatex binary not found: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=(
                "pdflatex is not installed on this server. "
                "Install TeX Live or MiKTeX to enable PDF generation."
            ),
        ) from exc
    except subprocess.TimeoutExpired as exc:
        logger.error("pdflatex timed out after %ss", exc.timeout)
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation timed out after {exc.timeout} seconds.",
        ) from exc
    except CompilationError as exc:
        logger.error("LaTeX compilation failed (rc=%d): %s", exc.returncode, exc.message)
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {exc.message}",
        ) from exc

    # ── 4. Stream PDF back to client ───────────────────────────────────────
    logger.info("Streaming PDF (%d bytes) to client", len(pdf_bytes))
    return StreamingResponse(
        content=io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="resume.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
