from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Default to docker-compose postgres credentials
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://resume_user:resume_password@localhost:5432/resume_maker"
)

# asyncpg does not accept `sslmode` as a URL query parameter (that's psycopg2 syntax).
# Strip it from the URL and pass SSL as a connect_arg instead.
connect_args = {}
if "sslmode=require" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")
    connect_args["ssl"] = "require"

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
