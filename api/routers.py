from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from db.database import get_db
from db.models import User, UserProfile, UserExperience, UserSkill, UserProject, UserEducation, UserSocialLink
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/vault", tags=["vault"])

# --- Profiles ---
class ProfileSchema(BaseModel):
    first_name: str
    last_name: str
    phone: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None

@router.get("/profile", response_model=ProfileSchema)
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalars().first()
    if not profile:
        return {"first_name": "", "last_name": ""}
    return profile

@router.put("/profile", response_model=ProfileSchema)
async def update_profile(data: ProfileSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalars().first()
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    
    profile.first_name = data.first_name
    profile.last_name = data.last_name
    profile.phone = data.phone
    profile.location = data.location
    profile.summary = data.summary
    await db.commit()
    return data

# --- Experiences ---
class ExperienceSchema(BaseModel):
    id: Optional[str] = None
    company_name: str
    job_title: str
    location: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False
    raw_description: Optional[str] = None

@router.get("/experiences", response_model=List[ExperienceSchema])
async def get_experiences(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserExperience).where(UserExperience.user_id == user.id))
    return [{"id": str(e.id), **{k: getattr(e, k) for k in ExperienceSchema.__fields__.keys() if k != 'id'}} for e in result.scalars().all()]

@router.post("/experiences", response_model=ExperienceSchema)
async def add_experience(data: ExperienceSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    new_exp = UserExperience(
        user_id=user.id,
        company_name=data.company_name,
        job_title=data.job_title,
        location=data.location,
        start_date=data.start_date,
        end_date=data.end_date,
        is_current=data.is_current,
        raw_description=data.raw_description
    )
    db.add(new_exp)
    await db.commit()
    await db.refresh(new_exp)
    return {"id": str(new_exp.id), **data.dict()}

# --- Skills ---
class SkillSchema(BaseModel):
    id: Optional[str] = None
    skill_name: str
    category: Optional[str] = None

@router.get("/skills", response_model=List[SkillSchema])
async def get_skills(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSkill).where(UserSkill.user_id == user.id))
    return [{"id": str(s.id), "skill_name": s.skill_name, "category": s.category} for s in result.scalars().all()]

@router.post("/skills", response_model=SkillSchema)
async def add_skill(data: SkillSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    new_skill = UserSkill(user_id=user.id, skill_name=data.skill_name, category=data.category)
    db.add(new_skill)
    await db.commit()
    await db.refresh(new_skill)
    return {"id": str(new_skill.id), "skill_name": new_skill.skill_name, "category": new_skill.category}

# --- Projects ---
class ProjectSchema(BaseModel):
    id: Optional[str] = None
    title: str
    role: Optional[str] = None
    repository_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    tech_stack: Optional[List[str]] = []
    raw_description: Optional[str] = None

@router.get("/projects", response_model=List[ProjectSchema])
async def get_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProject).where(UserProject.user_id == user.id))
    return [{"id": str(p.id), **{k: getattr(p, k) for k in ProjectSchema.__fields__.keys() if k != 'id'}} for p in result.scalars().all()]

@router.post("/projects", response_model=ProjectSchema)
async def add_project(data: ProjectSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    new_proj = UserProject(
        user_id=user.id,
        title=data.title,
        role=data.role,
        repository_url=data.repository_url,
        live_demo_url=data.live_demo_url,
        tech_stack=data.tech_stack,
        raw_description=data.raw_description
    )
    db.add(new_proj)
    await db.commit()
    await db.refresh(new_proj)
    return {"id": str(new_proj.id), **data.dict()}

# --- Education ---
class EducationSchema(BaseModel):
    id: Optional[str] = None
    institution: str
    degree: str
    field_of_study: str
    start_date: date
    end_date: Optional[date] = None

@router.get("/educations", response_model=List[EducationSchema])
async def get_educations(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserEducation).where(UserEducation.user_id == user.id))
    return [{"id": str(e.id), **{k: getattr(e, k) for k in EducationSchema.__fields__.keys() if k != 'id'}} for e in result.scalars().all()]

@router.post("/educations", response_model=EducationSchema)
async def add_education(data: EducationSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    new_edu = UserEducation(
        user_id=user.id,
        institution=data.institution,
        degree=data.degree,
        field_of_study=data.field_of_study,
        start_date=data.start_date,
        end_date=data.end_date
    )
    db.add(new_edu)
    await db.commit()
    await db.refresh(new_edu)
    return {"id": str(new_edu.id), **data.dict()}

# --- Social Links ---
class SocialLinkSchema(BaseModel):
    id: Optional[str] = None
    platform_name: str
    url: str
    display_text: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0

@router.get("/socials", response_model=List[SocialLinkSchema])
async def get_socials(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSocialLink).where(UserSocialLink.user_id == user.id))
    return [{"id": str(e.id), **{k: getattr(e, k) for k in SocialLinkSchema.__fields__.keys() if k != 'id'}} for e in result.scalars().all()]

@router.post("/socials", response_model=SocialLinkSchema)
async def add_social(data: SocialLinkSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    new_social = UserSocialLink(
        user_id=user.id,
        platform_name=data.platform_name,
        url=data.url,
        display_text=data.display_text,
        is_active=data.is_active,
        sort_order=data.sort_order
    )
    db.add(new_social)
    await db.commit()
    await db.refresh(new_social)
    return {"id": str(new_social.id), **data.dict()}

