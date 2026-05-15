"""
Admin-only API routes.

Authentication: An `X-Admin-Secret` header must match the ADMIN_SECRET env var.
These routes are intentionally separate from the user-facing auth system so they
can be locked down independently (e.g., network-level, or rotated at any time).
"""

import os
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from db.database import get_db
from db.models import User, UserProfile, UserSettings, UserExperience, UserProject, UserSkill, UserEducation, UserSocialLink, JobApplication, Resume

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "admin_secret_change_me")

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(x_admin_secret: Optional[str] = Header(None)):
    """Dependency: validates the X-Admin-Secret header."""
    if not x_admin_secret or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid or missing admin secret")


# ── Response schemas ──────────────────────────────────────────────────────────

class AdminUserSummary(BaseModel):
    id: str
    email: str
    is_active: bool
    created_at: Optional[datetime]
    first_name: Optional[str]
    last_name: Optional[str]
    ai_credits: Optional[int]
    experience_count: int
    project_count: int
    skill_count: int
    application_count: int

class AdminUserDetail(AdminUserSummary):
    location: Optional[str]
    phone: Optional[str]
    summary: Optional[str]
    preferred_template: Optional[str]

class SystemStats(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    total_experiences: int
    total_projects: int
    total_skills: int
    total_applications: int
    total_resumes: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=SystemStats, dependencies=[Depends(_require_admin)])
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    """High-level platform statistics."""
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    active_users = (await db.execute(select(func.count()).select_from(User).where(User.is_active == True))).scalar()
    total_exp = (await db.execute(select(func.count()).select_from(UserExperience))).scalar()
    total_proj = (await db.execute(select(func.count()).select_from(UserProject))).scalar()
    total_skills = (await db.execute(select(func.count()).select_from(UserSkill))).scalar()
    total_apps = (await db.execute(select(func.count()).select_from(JobApplication))).scalar()
    total_resumes = (await db.execute(select(func.count()).select_from(Resume))).scalar()

    return SystemStats(
        total_users=total_users,
        active_users=active_users,
        inactive_users=total_users - active_users,
        total_experiences=total_exp,
        total_projects=total_proj,
        total_skills=total_skills,
        total_applications=total_apps,
        total_resumes=total_resumes,
    )


@router.get("/users", response_model=List[AdminUserSummary], dependencies=[Depends(_require_admin)])
async def list_users(db: AsyncSession = Depends(get_db)):
    """List all users with profile + counts."""
    users_result = await db.execute(select(User).order_by(desc(User.created_at)))
    users = users_result.scalars().all()

    summaries = []
    for user in users:
        profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
        settings = (await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))).scalars().first()
        exp_count = (await db.execute(select(func.count()).select_from(UserExperience).where(UserExperience.user_id == user.id))).scalar()
        proj_count = (await db.execute(select(func.count()).select_from(UserProject).where(UserProject.user_id == user.id))).scalar()
        skill_count = (await db.execute(select(func.count()).select_from(UserSkill).where(UserSkill.user_id == user.id))).scalar()
        app_count = (await db.execute(select(func.count()).select_from(JobApplication).where(JobApplication.user_id == user.id))).scalar()

        summaries.append(AdminUserSummary(
            id=str(user.id),
            email=user.email,
            is_active=user.is_active,
            created_at=user.created_at,
            first_name=profile.first_name if profile else None,
            last_name=profile.last_name if profile else None,
            ai_credits=settings.ai_credits if settings else None,
            experience_count=exp_count,
            project_count=proj_count,
            skill_count=skill_count,
            application_count=app_count,
        ))

    return summaries


@router.get("/users/{user_id}", response_model=AdminUserDetail, dependencies=[Depends(_require_admin)])
async def get_user_detail(user_id: str, db: AsyncSession = Depends(get_db)):
    """Full details for a single user."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
    settings = (await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))).scalars().first()
    exp_count = (await db.execute(select(func.count()).select_from(UserExperience).where(UserExperience.user_id == user.id))).scalar()
    proj_count = (await db.execute(select(func.count()).select_from(UserProject).where(UserProject.user_id == user.id))).scalar()
    skill_count = (await db.execute(select(func.count()).select_from(UserSkill).where(UserSkill.user_id == user.id))).scalar()
    app_count = (await db.execute(select(func.count()).select_from(JobApplication).where(JobApplication.user_id == user.id))).scalar()

    return AdminUserDetail(
        id=str(user.id),
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
        first_name=profile.first_name if profile else None,
        last_name=profile.last_name if profile else None,
        location=profile.location if profile else None,
        phone=profile.phone if profile else None,
        summary=profile.summary if profile else None,
        ai_credits=settings.ai_credits if settings else None,
        preferred_template=settings.preferred_template_id if settings else None,
        experience_count=exp_count,
        project_count=proj_count,
        skill_count=skill_count,
        application_count=app_count,
    )


class ToggleActiveResponse(BaseModel):
    user_id: str
    is_active: bool
    message: str

@router.patch("/users/{user_id}/toggle-active", response_model=ToggleActiveResponse, dependencies=[Depends(_require_admin)])
async def toggle_user_active(user_id: str, db: AsyncSession = Depends(get_db)):
    """Activate or deactivate a user account."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    await db.commit()
    action = "activated" if user.is_active else "deactivated"
    return ToggleActiveResponse(user_id=str(user.id), is_active=user.is_active, message=f"User {action} successfully")


class UpdateCreditsRequest(BaseModel):
    ai_credits: int

@router.patch("/users/{user_id}/credits", dependencies=[Depends(_require_admin)])
async def update_user_credits(user_id: str, body: UpdateCreditsRequest, db: AsyncSession = Depends(get_db)):
    """Update AI credits for a user."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    settings = (await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))).scalars().first()
    if not settings:
        raise HTTPException(status_code=404, detail="User settings not found")

    settings.ai_credits = body.ai_credits
    await db.commit()
    return {"user_id": user_id, "ai_credits": settings.ai_credits}


class UserApplication(BaseModel):
    id: str
    job_title: str
    company_name: str
    job_url: Optional[str]
    status: str
    applied_at: Optional[datetime]
    has_resume: bool

@router.get("/users/{user_id}/applications", response_model=List[UserApplication], dependencies=[Depends(_require_admin)])
async def get_user_applications(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get all job applications for a user."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    apps_result = await db.execute(
        select(JobApplication).where(JobApplication.user_id == user_id).order_by(desc(JobApplication.applied_at))
    )
    apps = apps_result.scalars().all()

    result = []
    for app in apps:
        resume = (await db.execute(select(Resume).where(Resume.application_id == app.id))).scalars().first()
        result.append(UserApplication(
            id=str(app.id),
            job_title=app.job_title,
            company_name=app.company_name,
            job_url=app.job_url,
            status=app.status,
            applied_at=app.applied_at,
            has_resume=resume is not None,
        ))
    return result


@router.delete("/users/{user_id}", dependencies=[Depends(_require_admin)])
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """Permanently delete a user and all their data (cascades via FK)."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()
    return {"success": True, "message": f"User {user_id} deleted permanently"}


class ImpersonateResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str
    expires_in_minutes: int

@router.post("/users/{user_id}/impersonate", response_model=ImpersonateResponse, dependencies=[Depends(_require_admin)])
async def impersonate_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """
    Generate a short-lived JWT for the given user.
    The admin can use this token to log into the main application as that user.
    Token expires in 2 hours (much shorter than the normal 7-day user token).
    """
    from auth.security import create_access_token
    from datetime import timedelta

    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Cannot impersonate an inactive user")

    IMPERSONATE_EXPIRE_MINUTES = 120  # 2 hours
    token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=IMPERSONATE_EXPIRE_MINUTES)
    )
    return ImpersonateResponse(
        access_token=token,
        token_type="bearer",
        user_id=str(user.id),
        email=user.email,
        expires_in_minutes=IMPERSONATE_EXPIRE_MINUTES,
    )


# ── LLM Config endpoints ───────────────────────────────────────────────────────

from app_state import state as app_state, PROVIDER_CATALOGUE

class ProviderInfo(BaseModel):
    id: str
    name: str
    model: str
    description: str
    requires_key: bool
    key_env: Optional[str]
    local: bool
    has_key: bool
    is_active: bool

class ConfigResponse(BaseModel):
    current_provider: str
    providers: List[ProviderInfo]

class ConfigUpdateRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None  # required only when switching to a key-based provider without an existing key


@router.get("/config", response_model=ConfigResponse, dependencies=[Depends(_require_admin)])
async def get_config():
    """Return the current LLM provider and all available provider options."""
    providers = [ProviderInfo(**p) for p in app_state.catalogue_with_status()]
    return ConfigResponse(current_provider=app_state.provider_name, providers=providers)


@router.put("/config", dependencies=[Depends(_require_admin)])
async def update_config(body: ConfigUpdateRequest, db: AsyncSession = Depends(get_db)):
    """
    Hot-swap the LLM provider at runtime.
    - provider: one of ollama | gemma_ollama | groq | gemini | anthropic
    - api_key:  optional — only needed when switching to a cloud provider without a saved key
    The active provider is persisted to the system_config DB table and survives restarts.
    """
    catalogue_entry = next((p for p in PROVIDER_CATALOGUE if p["id"] == body.provider), None)
    if not catalogue_entry:
        raise HTTPException(status_code=400, detail=f"Unknown provider '{body.provider}'")

    # If key is required, make sure we either have it saved or one is supplied
    if catalogue_entry["requires_key"] and catalogue_entry["key_env"]:
        existing_key = os.getenv(catalogue_entry["key_env"], "")
        if not existing_key and not body.api_key:
            raise HTTPException(
                status_code=422,
                detail=f"Provider '{body.provider}' requires an API key ({catalogue_entry['key_env']}). "
                       f"Supply it in the api_key field."
            )

    try:
        import asyncio
        # switch_provider writes to DB then rebuilds pipeline (pipeline build is CPU-bound → thread)
        await asyncio.to_thread(_sync_switch, body.provider, body.api_key)
        # persist to DB (must happen on the event loop)
        from db.models import SystemConfig
        from sqlalchemy.future import select as sa_select
        result = await db.execute(sa_select(SystemConfig).where(SystemConfig.key == "llm_provider"))
        row = result.scalars().first()
        if row:
            row.value = body.provider
        else:
            db.add(SystemConfig(key="llm_provider", value=body.provider))
        await db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provider switch failed: {e}")

    return {
        "success": True,
        "provider": body.provider,
        "model": catalogue_entry["model"],
        "message": f"Switched to {catalogue_entry['name']} ({catalogue_entry['model']})"
    }


def _sync_switch(provider: str, api_key: str | None):
    """Synchronous inner call — runs in a thread pool to avoid blocking the event loop."""
    import os
    catalogue_entry = next((p for p in PROVIDER_CATALOGUE if p["id"] == provider), None)
    if api_key and catalogue_entry and catalogue_entry["key_env"]:
        os.environ[catalogue_entry["key_env"]] = api_key
    from app_state import _build_pipeline
    new_llm, new_pipeline = _build_pipeline(provider)
    app_state.provider_name = provider
    app_state._llm_provider = new_llm
    app_state._pipeline = new_pipeline
