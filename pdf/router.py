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

class Experience(BaseModel):
    company: str
    title: str
    dates: str
    location: str = ""
    bullets: list[str]

class Project(BaseModel):
    title: str
    role: str = ""
    dates: str = ""
    tech_stack: str = ""
    repository_url: str = ""
    live_demo_url: str = ""
    bullets: list[str]

class Education(BaseModel):
    institution: str
    degree: str
    dates: str

class SkillCategory(BaseModel):
    category: str
    skills: list[str]

class SocialLink(BaseModel):
    platform_name: str
    url: str
    display_text: str = ""

class TemplateConfig(BaseModel):
    font_size: str = "11pt"
    font_family: str = "sans-serif" # "sans-serif" or "serif"
    section_order: list[str] = ["summary", "experiences", "education", "skills", "projects"]

class ResumePDFRequest(BaseModel):
    """
    Structured dynamic resume data.
    """
    candidate_name: str = "Candidate Name"
    candidate_email: str = "candidate@example.com"
    candidate_phone: str = ""
    candidate_location: str = ""
    candidate_summary: str = ""
    
    experiences: list[Experience] = []
    projects: list[Project] = []
    education_blocks: list[Education] = []
    grouped_skills: list[SkillCategory] = []
    social_links: list[SocialLink] = []

    template_config: TemplateConfig = Field(default_factory=TemplateConfig)


# ── Endpoint ───────────────────────────────────────────────────────────────

def build_latex_source(request: ResumePDFRequest) -> str:
    # ── 1. Dynamic Block Builders ──────────────────────────────────────────
    
    # Summary
    sanitized_summary = sanitize(request.candidate_summary).strip()
    summary_block = ""
    if sanitized_summary:
        summary_block = f"\\section{{Professional Summary}}\n\\small{{{sanitized_summary}}}\n"

    # Education
    edu_block = "\\section{Education}\n  \\resumeSubHeadingListStart\n" if request.education_blocks else ""
    for edu in request.education_blocks:
        edu_block += f"    \\resumeSubheading\n      {{{sanitize(edu.institution)}}}{{}}\n      {{{sanitize(edu.degree)}}}{{{sanitize(edu.dates)}}}\n"
    if request.education_blocks:
        edu_block += "  \\resumeSubHeadingListEnd\n"

    # Experiences
    exp_block = ""
    if request.experiences:
        exp_block = "\\section{Experience}\n  \\resumeSubHeadingListStart\n"
        for exp in request.experiences:
            exp_block += f"    \\resumeSubheading\n      {{{sanitize(exp.title)}}}{{{sanitize(exp.dates)}}}\n      {{{sanitize(exp.company)}}}{{{sanitize(exp.location)}}}\n"
            if exp.bullets:
                exp_block += "      \\resumeItemListStart\n"
                exp_block += sanitize_bullet_list(exp.bullets) + "\n"
                exp_block += "      \\resumeItemListEnd\n"
        exp_block += "  \\resumeSubHeadingListEnd\n"

    # Projects
    proj_block = ""
    if request.projects:
        proj_block = "\\section{Projects}\n  \\resumeSubHeadingListStart\n"
        for proj in request.projects:
            tech_str = f" $|$ \\emph{{{sanitize(proj.tech_stack)}}}" if proj.tech_stack else ""
            
            # Optional Link
            link_str = ""
            if proj.repository_url:
                link_str += f" $|$ \\href{{{sanitize(proj.repository_url)}}}{{\\underline{{GitHub}}}}"
            if proj.live_demo_url:
                link_str += f" $|$ \\href{{{sanitize(proj.live_demo_url)}}}{{\\underline{{Live Demo}}}}"

            proj_block += f"    \\resumeProjectHeading\n      {{\\textbf{{{sanitize(proj.title)}}}{tech_str}{link_str}}}{{{sanitize(proj.dates)}}}\n"
            if proj.bullets:
                proj_block += "      \\resumeItemListStart\n"
                proj_block += sanitize_bullet_list(proj.bullets) + "\n"
                proj_block += "      \\resumeItemListEnd\n"
        proj_block += "  \\resumeSubHeadingListEnd\n"

    # Skills Categorized
    skills_block = ""
    if request.grouped_skills:
        skills_block = "\\section{Technical Skills}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n"
        for sc in request.grouped_skills:
            if sc.skills:
                skills_val = ", ".join(sc.skills)
                skills_block += f"     \\textbf{{{sanitize(sc.category)}}}{{: {sanitize(skills_val)}}} \\\\\n"
        skills_block += "    }}\n \\end{itemize}\n"

    # Social Links
    social_block = ""
    for i, s in enumerate(request.social_links):
        display = s.display_text if s.display_text else s.url.replace("https://", "").replace("http://", "")
        # Map platform name to fontawesome5 icon
        p_name = s.platform_name.lower()
        if "github" in p_name:
            icon = "\\faGithub"
        elif "linkedin" in p_name:
            icon = "\\faLinkedin"
        elif "twitter" in p_name or "x" == p_name:
            icon = "\\faTwitter"
        elif "youtube" in p_name:
            icon = "\\faYoutube"
        else:
            icon = "\\faLink"
            
        separator = " $|$ " if i > 0 or request.candidate_location or request.candidate_email or request.candidate_phone else ""
        social_block += f"{separator}{icon} \\hspace{{2pt}} \\href{{{sanitize(s.url)}}}{{\\underline{{{sanitize(display)}}}}}"

    # Format phone, email, location with icons
    phone_fmt = f"\\faPhone \\hspace{{2pt}} {sanitize(request.candidate_phone)}" if request.candidate_phone else ""
    
    email_sep = " $|$ " if phone_fmt and request.candidate_email else ""
    email_fmt = f"{email_sep}\\faEnvelope \\hspace{{2pt}} \\href{{mailto:{sanitize(request.candidate_email)}}}{{\\underline{{{sanitize(request.candidate_email)}}}}}" if request.candidate_email else ""
    
    loc_sep = " $|$ " if (phone_fmt or email_fmt) and request.candidate_location else ""
    loc_fmt = f"{loc_sep}\\faMapMarker* \\hspace{{2pt}} {sanitize(request.candidate_location)}" if request.candidate_location else ""

    f_fam = request.template_config.font_family
    if f_fam == "serif":
        font_pkg = "\\renewcommand{\\familydefault}{\\rmdefault}"
    elif f_fam == "monospace":
        font_pkg = "\\renewcommand{\\familydefault}{\\ttdefault}"
    else:
        font_pkg = "\\renewcommand{\\familydefault}{\\sfdefault}"

    blocks = {
        "summary": summary_block,
        "experiences": exp_block,
        "projects": proj_block,
        "education": edu_block,
        "skills": skills_block
    }
    
    body_block = "\n\n".join(blocks[sec] for sec in request.template_config.section_order if sec in blocks and blocks[sec])

    data = {
        "CANDIDATE_NAME":     sanitize(request.candidate_name),
        "CANDIDATE_EMAIL":    email_fmt,
        "CANDIDATE_PHONE":    phone_fmt,
        "CANDIDATE_LOCATION": loc_fmt,
        "SOCIAL_LINKS_BLOCK": social_block,
        "BODY_BLOCK":         body_block,
        "DOC_FONT_SIZE":      sanitize(request.template_config.font_size),
        "DOC_FONT_FAMILY":    font_pkg,
    }

    # ── 2. Render template ─────────────────────────────────────────────────
    try:
        return render_template(data)
    except TemplateNotFoundError as exc:
        logger.error("LaTeX template missing: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Server configuration error: LaTeX template not found.",
        ) from exc


@router.post(
    "/preview-latex",
    summary="Preview raw generated LaTeX source",
    response_model=dict,
)
async def preview_latex(request: ResumePDFRequest):
    """
    Returns the raw generated LaTeX string for the given resume data.
    """
    latex_source = build_latex_source(request)
    return {"latex": latex_source}

class RawCompileRequest(BaseModel):
    latex_source: str

@router.post(
    "/compile-raw",
    summary="Compile raw LaTeX string to PDF",
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "Compiled PDF document.",
        },
        500: {"description": "LaTeX compilation error or missing pdflatex binary."},
    },
)
async def compile_raw_latex(request: RawCompileRequest) -> StreamingResponse:
    """
    Accepts a raw LaTeX string and compiles it to PDF using pdflatex.
    """
    logger.info("Raw PDF compilation requested (%d bytes of LaTeX)", len(request.latex_source))
    
    # ── 3. Compile PDF (offloaded from async event loop) ──────────────────
    try:
        pdf_bytes: bytes = await asyncio.to_thread(compile_latex, request.latex_source)
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
    """
    logger.info("PDF generation requested for %s", request.candidate_name)
    latex_source = build_latex_source(request)
    return await compile_raw_latex(RawCompileRequest(latex_source=latex_source))
