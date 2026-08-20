"""Opportunities API routes."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.scout import discover_opportunities
from app.core.security import get_current_user_id
from app.db.postgres import get_db

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

@router.get("")
async def get_opportunities(category: str | None = Query(None), user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    valid = {"job", "club", "competition", "scholarship", "event", "volunteer"}
    if category and category not in valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": {"code": "invalid_category", "message": f"Valid: {', '.join(sorted(valid))}"}})
    try:
        return await discover_opportunities(db, user_id, category)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": {"code": str(e).split(":")[0], "message": str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)}})
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"error": {"code": str(e).split(":")[0], "message": str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)}})