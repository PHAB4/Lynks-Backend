from pydantic import BaseModel
from typing import Optional
from fastapi import HTTPException, APIRouter, Depends, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import supabase
from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import User
from app.services.storage import (
    upload_profile_picture,
    delete_profile_picture,
    ALLOWED_AVATAR_TYPES,
    MAX_AVATAR_SIZE,
)

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    country: Optional[str] = None
    education_level: Optional[str] = None
    employment_status: Optional[str] = None
    phone: Optional[str] = None
    interests: Optional[list[str]] = None
    career_path: Optional[str] = None


class CareerPathUpdate(BaseModel):
    career_path: str


def _profile_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "name": user.name,
        "age": user.age,
        "country": user.country,
        "education_level": user.education_level,
        "employment_status": user.employment_status,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "career_path": user.career_path,
        "interests": user.interests,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("")
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _profile_dict(user)


@router.patch("")
async def update_profile(
    updates: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
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

    return _profile_dict(user)


@router.patch("/career-path")
async def update_career_path(
    updates: CareerPathUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.career_path = updates.career_path
    await db.commit()
    await db.refresh(user)

    return {"career_path": user.career_path}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Allowed: JPEG, PNG, GIF",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(file_bytes)} bytes. Max: {MAX_AVATAR_SIZE} bytes",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.avatar_url:
        delete_profile_picture(user.avatar_url)

    avatar_url = upload_profile_picture(user_id, file_bytes, file.filename or "avatar.jpg", file.content_type)

    user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(user)

    return {"avatar_url": avatar_url}


@router.delete("/avatar")
async def remove_avatar(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.avatar_url:
        raise HTTPException(status_code=404, detail="No profile picture to remove")

    delete_profile_picture(user.avatar_url)

    user.avatar_url = None
    await db.commit()
    await db.refresh(user)

    return {"message": "Profile picture removed"}
