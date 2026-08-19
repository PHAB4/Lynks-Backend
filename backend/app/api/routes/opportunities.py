"""
Opportunities API routes — matches API_CONTRACT.md.

GET /opportunities              -> discover all opportunities
GET /opportunities?category=X   -> filter by category
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.agents.scout import discover_opportunities
from backend.app.core.security import get_current_user_id
from backend.app.db.postgres import get_db

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("")
async def get_opportunities(
    category: str | None = Query(None, description="Filter by: job, club, competition, scholarship, event, volunteer"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Discover Caribbean-relevant opportunities for the user.
    """
    valid_categories = {"job", "club", "competition", "scholarship", "event", "volunteer"}
    if category and category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "invalid_category",
                    "message": f"Valid categories: {', '.join(sorted(valid_categories))}",
                }
            },
        )

    try:
        opportunities = await discover_opportunities(db, user_id, category)
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": code, "message": message}},
        )
    except RuntimeError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": code, "message": message}},
        )

    return opportunities