from pydantic import BaseModel
from typing import Optional
from fastapi import HTTPException, APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import supabase
from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import User

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    country: Optional[str] = None
    education_level: Optional[str] = None
    interests: Optional[list[str]] = None


class CareerPathUpdate(BaseModel):
    career_path: str


@router.get("")
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "name": user.name,
        "age": user.age,
        "country": user.country,
        "education_level": user.education_level,
        "career_path": user.career_path,
        "interests": user.interests,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.patch("")
async def update_profile(
    updates: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update profile fields (only sends fields that are set)."""
    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for key, value in update_data.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "name": user.name,
        "age": user.age,
        "country": user.country,
        "education_level": user.education_level,
        "career_path": user.career_path,
        "interests": user.interests,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.patch("/career-path")
async def update_career_path(
    updates: CareerPathUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update career path only."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.career_path = updates.career_path
    await db.commit()
    await db.refresh(user)

    return {"career_path": user.career_path}
