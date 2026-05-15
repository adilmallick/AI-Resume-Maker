from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import io
import os
import logging
from datetime import date, datetime

from db.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from db.models import User, UserProfile, UserExperience, UserSkill, UserProject, UserEducation
from auth.dependencies import get_current_user
from ai.resume_parser import extract_resume_data, ResumeExtractionSchema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vault/resume", tags=["vault", "resume"])

def parse_date(date_str: str) -> Optional[date]:
    """Parse a date string from various formats into a Python date object.

    Handles ISO formats (YYYY-MM-DD, YYYY-MM, YYYY) as well as human-readable
    formats returned by the LLM such as 'Aug 2023', 'August 2023',
    'Aug, 2023', 'August, 2023', 'Present', and 'Current'.
    """
    if not date_str:
        return None
    date_str = date_str.strip()

    # Treat "Present" / "Current" / "Now" as no end date
    if date_str.lower() in ("present", "current", "now", "ongoing"):
        return None

    # --- ISO / numeric formats ---
    try:
        if len(date_str) >= 10:
            return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        if len(date_str) >= 7:
            return datetime.strptime(date_str[:7], "%Y-%m").date()
        if len(date_str) == 4:
            return datetime.strptime(date_str, "%Y").date()
    except ValueError:
        pass

    # --- Human-readable formats (LLM output) ---
    # Normalise: remove commas ("Aug, 2023" → "Aug 2023")
    normalised = date_str.replace(",", "").strip()
    for fmt in ("%b %Y", "%B %Y"):   # abbreviated / full month name
        try:
            # strptime sets day=1 automatically for month-only formats
            return datetime.strptime(normalised, fmt).date()
        except ValueError:
            continue

    # If nothing matched, log a warning and return None (safer than today())
    logger.warning("parse_date: could not parse %r — returning None", date_str)
    return None

def extract_text_from_file(file: UploadFile, content: bytes) -> str:
    ext = os.path.splitext(file.filename)[1].lower()
    text = ""
    if ext == ".pdf":
        import pypdf
        try:
            pdf = pypdf.PdfReader(io.BytesIO(content))
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        except Exception as e:
            logger.error(f"Error reading PDF: {e}")
            raise HTTPException(status_code=400, detail="Could not read the PDF file")
    elif ext == ".docx":
        import docx
        try:
            doc = docx.Document(io.BytesIO(content))
            for para in doc.paragraphs:
                text += para.text + "\n"
        except Exception as e:
            logger.error(f"Error reading DOCX: {e}")
            raise HTTPException(status_code=400, detail="Could not read the DOCX file")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF or DOCX.")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract any text from the file")
    
    return text

@router.post("/extract", response_model=ResumeExtractionSchema)
async def extract_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    content = await file.read()
    text = extract_text_from_file(file, content)
    
    try:
        structured_data = extract_resume_data(text)
        return structured_data
    except Exception as e:
        logger.error(f"Failed to parse resume: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse resume with AI: {str(e)}")

class SaveExtractedRequest(BaseModel):
    strategy: str # 'append' or 'overwrite'
    data: ResumeExtractionSchema

@router.post("/save-extracted")
async def save_extracted(
    request: SaveExtractedRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = request.data
    # Always overwrite
    strategy = "overwrite"

    try:
        # Save Profile
        if data.profile:
            result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
            profile = result.scalars().first()
            if not profile:
                profile = UserProfile(user_id=user.id, first_name=data.profile.first_name, last_name=data.profile.last_name)
                db.add(profile)
            
            if strategy == "overwrite" or not profile.first_name:
                # Truncate first_name and last_name to 100 chars
                profile.first_name = (data.profile.first_name or "")[:100]
            if strategy == "overwrite" or not profile.last_name:
                profile.last_name = (data.profile.last_name or "")[:100]
            if strategy == "overwrite" or not profile.phone:
                profile.phone = (data.profile.phone or "")[:20] if data.profile.phone else None
            if strategy == "overwrite" or not profile.location:
                profile.location = (data.profile.location or "")[:100] if data.profile.location else None
            if strategy == "overwrite" or not profile.summary:
                profile.summary = data.profile.summary

        # Experiences
        if strategy == "overwrite":
            await db.execute(delete(UserExperience).where(UserExperience.user_id == user.id))
        for exp in data.experiences:
            start_dt = parse_date(exp.start_date) or date.today()
            end_dt = parse_date(exp.end_date)
            new_record = UserExperience(
                user_id=user.id,
                company_name=(exp.company_name or "")[:255],
                job_title=(exp.job_title or "")[:255],
                location=(exp.location or "")[:100] if exp.location else None,
                start_date=start_dt,
                end_date=end_dt,
                is_current=exp.is_current,
                raw_description=exp.raw_description
            )
            db.add(new_record)

        # Educations
        if strategy == "overwrite":
            await db.execute(delete(UserEducation).where(UserEducation.user_id == user.id))
        for edu in data.educations:
            start_dt = parse_date(edu.start_date) or date.today()
            end_dt = parse_date(edu.end_date)
            new_record = UserEducation(
                user_id=user.id,
                institution=(edu.institution or "")[:255],
                degree=(edu.degree or "")[:100],
                field_of_study=(edu.field_of_study or "")[:100],
                start_date=start_dt,
                end_date=end_dt
            )
            db.add(new_record)

        # Skills
        if strategy == "overwrite":
            await db.execute(delete(UserSkill).where(UserSkill.user_id == user.id))
        for skill in data.skills:
            new_record = UserSkill(
                user_id=user.id,
                skill_name=(skill.skill_name or "")[:100],
                category=(skill.category or "")[:50] if skill.category else None
            )
            db.add(new_record)

        # Projects
        if strategy == "overwrite":
            await db.execute(delete(UserProject).where(UserProject.user_id == user.id))
        for proj in data.projects:
            new_record = UserProject(
                user_id=user.id,
                title=(proj.title or "")[:255],
                role=(proj.role or "")[:150] if proj.role else None,
                repository_url=(proj.repository_url or "")[:1024] if proj.repository_url else None,
                live_demo_url=(proj.live_demo_url or "")[:1024] if proj.live_demo_url else None,
                tech_stack=proj.tech_stack,
                raw_description=proj.raw_description
            )
            db.add(new_record)

        await db.commit()
        return {"message": "Data saved successfully"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving extracted data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
