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
    email: Optional[str] = None
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
    profile.email = data.email
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
    return {**data.dict(), "id": str(new_exp.id)}

@router.put("/experiences/{item_id}", response_model=ExperienceSchema)
async def update_experience(item_id: str, data: ExperienceSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserExperience).where(UserExperience.id == item_id, UserExperience.user_id == user.id))
    exp = result.scalars().first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")
    
    exp.company_name = data.company_name
    exp.job_title = data.job_title
    exp.location = data.location
    exp.start_date = data.start_date
    exp.end_date = data.end_date
    exp.is_current = data.is_current
    exp.raw_description = data.raw_description
    
    await db.commit()
    return {**data.dict(), "id": str(exp.id)}

@router.delete("/experiences/{item_id}")
async def delete_experience(item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserExperience).where(UserExperience.id == item_id, UserExperience.user_id == user.id))
    exp = result.scalars().first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")
    
    await db.delete(exp)
    await db.commit()
    return {"success": True}

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

@router.put("/skills/{item_id}", response_model=SkillSchema)
async def update_skill(item_id: str, data: SkillSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSkill).where(UserSkill.id == item_id, UserSkill.user_id == user.id))
    skill = result.scalars().first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    skill.skill_name = data.skill_name
    skill.category = data.category
    
    await db.commit()
    return {"id": str(skill.id), "skill_name": skill.skill_name, "category": skill.category}

@router.delete("/skills/{item_id}")
async def delete_skill(item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSkill).where(UserSkill.id == item_id, UserSkill.user_id == user.id))
    skill = result.scalars().first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    await db.delete(skill)
    await db.commit()
    return {"success": True}

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
    return {**data.dict(), "id": str(new_proj.id)}

@router.put("/projects/{item_id}", response_model=ProjectSchema)
async def update_project(item_id: str, data: ProjectSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProject).where(UserProject.id == item_id, UserProject.user_id == user.id))
    proj = result.scalars().first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    proj.title = data.title
    proj.role = data.role
    proj.repository_url = data.repository_url
    proj.live_demo_url = data.live_demo_url
    proj.tech_stack = data.tech_stack
    proj.raw_description = data.raw_description
    
    await db.commit()
    return {**data.dict(), "id": str(proj.id)}

@router.delete("/projects/{item_id}")
async def delete_project(item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProject).where(UserProject.id == item_id, UserProject.user_id == user.id))
    proj = result.scalars().first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.delete(proj)
    await db.commit()
    return {"success": True}

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
    return {**data.dict(), "id": str(new_edu.id)}

@router.put("/educations/{item_id}", response_model=EducationSchema)
async def update_education(item_id: str, data: EducationSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserEducation).where(UserEducation.id == item_id, UserEducation.user_id == user.id))
    edu = result.scalars().first()
    if not edu:
        raise HTTPException(status_code=404, detail="Education not found")
    
    edu.institution = data.institution
    edu.degree = data.degree
    edu.field_of_study = data.field_of_study
    edu.start_date = data.start_date
    edu.end_date = data.end_date
    
    await db.commit()
    return {**data.dict(), "id": str(edu.id)}

@router.delete("/educations/{item_id}")
async def delete_education(item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserEducation).where(UserEducation.id == item_id, UserEducation.user_id == user.id))
    edu = result.scalars().first()
    if not edu:
        raise HTTPException(status_code=404, detail="Education not found")
    
    await db.delete(edu)
    await db.commit()
    return {"success": True}

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
    return {**data.dict(), "id": str(new_social.id)}

@router.put("/socials/{item_id}", response_model=SocialLinkSchema)
async def update_social(item_id: str, data: SocialLinkSchema, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSocialLink).where(UserSocialLink.id == item_id, UserSocialLink.user_id == user.id))
    social = result.scalars().first()
    if not social:
        raise HTTPException(status_code=404, detail="Social Link not found")
    
    social.platform_name = data.platform_name
    social.url = data.url
    social.display_text = data.display_text
    social.is_active = data.is_active
    social.sort_order = data.sort_order
    
    await db.commit()
    return {**data.dict(), "id": str(social.id)}

@router.delete("/socials/{item_id}")
async def delete_social(item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSocialLink).where(UserSocialLink.id == item_id, UserSocialLink.user_id == user.id))
    social = result.scalars().first()
    if not social:
        raise HTTPException(status_code=404, detail="Social Link not found")
    
    await db.delete(social)
    await db.commit()
    return {"success": True}

