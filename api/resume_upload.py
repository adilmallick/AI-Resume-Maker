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
    if not date_str:
        return None
    date_str = date_str.strip()
    try:
        if len(date_str) >= 10:
            return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        if len(date_str) >= 7:
            return datetime.strptime(date_str[:7], "%Y-%m").date()
        if len(date_str) == 4:
            return datetime.strptime(date_str, "%Y").date()
    except ValueError:
        pass
    
    return date.today() # fallback to avoid DB null constraint errors

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
    strategy = request.strategy
    data = request.data
    
    if strategy not in ["append", "overwrite"]:
        raise HTTPException(status_code=400, detail="Strategy must be 'append' or 'overwrite'")

    # Save Profile
    if data.profile:
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
        profile = result.scalars().first()
        if not profile:
            profile = UserProfile(user_id=user.id, first_name=data.profile.first_name, last_name=data.profile.last_name)
            db.add(profile)
        
        if strategy == "overwrite" or not profile.first_name:
            profile.first_name = data.profile.first_name
        if strategy == "overwrite" or not profile.last_name:
            profile.last_name = data.profile.last_name
        if strategy == "overwrite" or not profile.phone:
            profile.phone = data.profile.phone
        if strategy == "overwrite" or not profile.location:
            profile.location = data.profile.location
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
            company_name=exp.company_name,
            job_title=exp.job_title,
            location=exp.location,
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
            institution=edu.institution,
            degree=edu.degree,
            field_of_study=edu.field_of_study,
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
            skill_name=skill.skill_name,
            category=skill.category
        )
        db.add(new_record)

    # Projects
    if strategy == "overwrite":
        await db.execute(delete(UserProject).where(UserProject.user_id == user.id))
    for proj in data.projects:
        new_record = UserProject(
            user_id=user.id,
            title=proj.title,
            role=proj.role,
            repository_url=proj.repository_url,
            live_demo_url=proj.live_demo_url,
            tech_stack=proj.tech_stack,
            raw_description=proj.raw_description
        )
        db.add(new_record)

    await db.commit()
    return {"message": "Data saved successfully"}
