from pydantic import BaseModel
from typing import Optional
from fastapi import HTTPException, APIRouter, Depends
from backend.app.core.config import supabase
from backend.app.core.security import get_current_user

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    country: Optional[str] = None
    education_level: Optional[str] = None
    interests: Optional[list[str]] = None

class CareerPathUpdate(BaseModel):
    career_path: str

router = APIRouter()

@router.get("/profile")
async def get_profile(user_id: dict = Depends(get_current_user)):
    supabase.postgrest.auth(token=user_id["token"])
    response = supabase.table("users").select("*").eq("id", user_id["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    return response.data[0]

@router.patch("/profile")
async def update_profile(updates: ProfileUpdate, user_id: dict = Depends(get_current_user)):
    supabase.postgrest.auth(token=user_id["token"])
    response = supabase.table("users").update(updates.model_dump(exclude_unset=True)).eq("id", user_id["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    return response.data[0]


@router.patch("/profile/career-path")
async def update_career_path(updates: CareerPathUpdate, user_id: dict = Depends(get_current_user)):
    supabase.postgrest.auth(token=user_id["token"])
    response = supabase.table("users").update(updates.model_dump()).eq("id", user_id["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"career_path": response.data[0]["career_path"]}
