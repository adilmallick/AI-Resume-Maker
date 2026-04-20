import uuid
from sqlalchemy import Column, String, Text, Boolean, Date, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    experiences = relationship("UserExperience", back_populates="user", cascade="all, delete-orphan")
    educations = relationship("UserEducation", back_populates="user", cascade="all, delete-orphan")
    skills = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("UserProject", back_populates="user", cascade="all, delete-orphan")
    social_links = relationship("UserSocialLink", back_populates="user", cascade="all, delete-orphan")
    job_applications = relationship("JobApplication", back_populates="user", cascade="all, delete-orphan")

class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    preferred_template_id = Column(String(100), default="standard")
    ai_credits = Column(Integer, default=10)
    is_dark_mode_ui = Column(Boolean, default=True)

    user = relationship("User", back_populates="settings")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    location = Column(String(100))
    summary = Column(Text)

    user = relationship("User", back_populates="profile")

class UserSocialLink(Base):
    __tablename__ = "user_social_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    platform_name = Column(String(100), nullable=False)
    url = Column(String(1024), nullable=False)
    display_text = Column(String(255))
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    user = relationship("User", back_populates="social_links")

class UserExperience(Base):
    __tablename__ = "user_experiences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    company_name = Column(String(255), nullable=False)
    job_title = Column(String(255), nullable=False)
    location = Column(String(100))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    is_current = Column(Boolean, default=False)
    raw_description = Column(Text)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="experiences")

class UserEducation(Base):
    __tablename__ = "user_educations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    institution = Column(String(255), nullable=False)
    degree = Column(String(100), nullable=False)
    field_of_study = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)

    user = relationship("User", back_populates="educations")

class UserSkill(Base):
    __tablename__ = "user_skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    skill_name = Column(String(100), nullable=False)
    category = Column(String(50))

    user = relationship("User", back_populates="skills")

class UserProject(Base):
    __tablename__ = "user_projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String(255), nullable=False)
    role = Column(String(150))
    repository_url = Column(String(1024))
    live_demo_url = Column(String(1024))
    tech_stack = Column(ARRAY(String))
    raw_description = Column(Text)
    start_date = Column(Date)
    end_date = Column(Date)
    is_ongoing = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    user = relationship("User", back_populates="projects")

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    job_title = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=False)
    job_url = Column(String(1024))
    status = Column(String(50), default="Generated")
    applied_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="job_applications")
    resume = relationship("Resume", back_populates="application", uselist=False, cascade="all, delete-orphan")

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("job_applications.id", ondelete="CASCADE"), unique=True)
    generated_bullets = Column(JSONB)
    pdf_path = Column(String(1024))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("JobApplication", back_populates="resume")
