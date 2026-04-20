import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.future import select
from db.models import User, UserProfile
from auth.security import get_password_hash

async def test():
    e = create_async_engine('postgresql+asyncpg://resume_user:resume_password@localhost:5432/resume_maker')
    AsyncSessionLocal = async_sessionmaker(e, class_=AsyncSession, expire_on_commit=False)
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.email == 'test3@test.com'))
            if result.scalars().first():
                print("Exists")
                return

            hashed_pw = get_password_hash("123")
            new_user = User(email="test3@test.com", password_hash=hashed_pw)
            db.add(new_user)
            await db.flush()
            
            profile = UserProfile(
                user_id=new_user.id,
                first_name="A",
                last_name="B"
            )
            db.add(profile)
            await db.commit()
            print("Success")
    except Exception as ex:
        import traceback
        traceback.print_exc()

asyncio.run(test())
