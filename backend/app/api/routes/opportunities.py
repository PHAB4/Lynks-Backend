"""
Opportunities API routes — matches API_CONTRACT.md.

GET    /opportunities                    → list with filtering, sorting, pagination
GET    /opportunities/new-count          → new opportunity count (polling notifications)
GET    /opportunities/saved              → list saved opportunities
POST   /opportunities/{id}/save          → save an opportunity
DELETE /opportunities/{id}/save          → unsave an opportunity
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.scout import discover_opportunities, get_new_count, get_saved_opportunity_ids
from app.core.security import get_current_user_id
from app.db.postgres import get_db

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("")
async def list_opportunities(
    category: str | None = Query(None, description="Filter by: job, club, competition, scholarship, event, volunteer"),
    timeframe: str | None = Query(None, description="Filter by time: day, week, month, quarter, all"),
    sort: str = Query("relevance", description="Sort by: relevance, recent, salary"),
    page: int = Query(1, ge=1, description="Page number (offset pagination)"),
    limit: int = Query(20, ge=1, le=50, description="Results per page (max 50)"),
    saved_only: bool = Query(False, description="Only return saved opportunities"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Discover Caribbean-relevant opportunities for the user.

    Supports filtering by category, time range, and sorting.
    Returns paginated results with metadata.
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

    valid_timeframes = {"day", "week", "month", "quarter", "all"}
    if timeframe and timeframe not in valid_timeframes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "invalid_timeframe",
                    "message": f"Valid timeframes: {', '.join(sorted(valid_timeframes))}",
                }
            },
        )

    valid_sorts = {"relevance", "recent", "salary"}
    if sort not in valid_sorts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "invalid_sort",
                    "message": f"Valid sort options: {', '.join(sorted(valid_sorts))}",
                }
            },
        )

    try:
        result = await discover_opportunities(db, user_id, category, timeframe, sort, page, limit)
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

    # If saved_only, filter to only saved opportunities
    if saved_only:
        saved_ids = await get_saved_opportunity_ids(db, user_id)
        result["opportunities"] = [o for o in result["opportunities"] if o["id"] in saved_ids]
        result["metadata"]["total_available"] = len(result["opportunities"])
        result["metadata"]["returned"] = len(result["opportunities"])

    return result


@router.post("/refresh")
async def refresh_opportunities(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a manual refresh of the opportunity database."""
    try:
        from app.agents.opportunity_scraper import scrape_opportunities

        opportunities = await scrape_opportunities()
        return {
            "status": "ok",
            "count": len(opportunities),
            "sources": list({o.get("source_name", "unknown") for o in opportunities}),
            "message": f"Scraped {len(opportunities)} opportunities",
        }
    except (OSError, ValueError) as e:
        return {
            "status": "partial",
            "count": 0,
            "sources": [],
            "message": f"Scrape failed: {e!s}",
        }


@router.get("/new-count")
async def new_opportunity_count(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get count of new opportunities (first seen in last 24 hours).

    Frontend polls this endpoint every few minutes.
    If new_count > 0, show a notification badge.
    """
    result = await get_new_count(db)
    return result


@router.get("/saved")
async def list_saved_opportunities(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all saved opportunities for the authenticated user."""
    saved_ids = await get_saved_opportunity_ids(db, user_id)

    if not saved_ids:
        return {"saved": [], "total": 0}

    # Get all opportunities and filter to saved ones
    from app.agents.scout import CARIBBEAN_OPPORTUNITIES

    results = []
    for opp in CARIBBEAN_OPPORTUNITIES:
        opp_id = hashlib.md5(opp["title"].encode()).hexdigest()[:16]
        if opp_id in saved_ids:
            results.append(
                {
                    "id": opp_id,
                    "title": opp.get("title", "Unknown"),
                    "company": opp.get("company", "Unknown"),
                    "location": opp.get("location", "Caribbean"),
                    "description": opp.get("description", ""),
                    "category": opp.get("category", "event"),
                    "pay": opp.get("pay", "Varies"),
                    "salary_min": opp.get("salary_min"),
                    "salary_max": opp.get("salary_max"),
                    "salary_currency": opp.get("salary_currency"),
                    "age_requirement": opp.get("age_requirement"),
                    "experience_required": opp.get("experience_required", "None"),
                    "url": opp.get("url", ""),
                    "posted_at": opp.get("posted_at"),
                    "first_seen_at": opp.get("first_seen_at"),
                    "source_name": opp.get("source_name", "curated"),
                    "image_url": opp.get("image_url"),
                    "is_saved": True,
                    "relevance_score": None,
                }
            )

    return {"saved": results, "total": len(results)}


@router.post("/{opportunity_id}/save")
async def save_opportunity(
    opportunity_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save/bookmark an opportunity for the authenticated user."""
    try:
        # Check if already saved
        existing = await db.execute(
            text("SELECT id FROM saved_opportunities WHERE user_id = :uid AND opportunity_id = :oid"),
            {"uid": user_id, "oid": opportunity_id},
        )
        if existing.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "already_saved",
                        "message": "You have already saved this opportunity",
                    }
                },
            )

        # Insert the save
        now = datetime.now(timezone.utc)
        await db.execute(
            text("INSERT INTO saved_opportunities (user_id, opportunity_id, saved_at) VALUES (:uid, :oid, :saved_at)"),
            {"uid": user_id, "oid": opportunity_id, "saved_at": now},
        )
        await db.commit()

        return {"success": True, "saved_at": now.isoformat()}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        # Table may not exist yet — return helpful error
        if "saved_opportunities" in str(e) and "does not exist" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail={
                    "error": {
                        "code": "table_not_found",
                        "message": "saved_opportunities table not created yet. Run the migration SQL first.",
                    }
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "save_failed", "message": str(e)}},
        )


@router.delete("/{opportunity_id}/save")
async def unsave_opportunity(
    opportunity_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove a saved opportunity."""
    try:
        result = await db.execute(
            text("DELETE FROM saved_opportunities WHERE user_id = :uid AND opportunity_id = :oid"),
            {"uid": user_id, "oid": opportunity_id},
        )
        await db.commit()

        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "not_found",
                        "message": "This opportunity was not saved",
                    }
                },
            )

        return {"success": True}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        if "saved_opportunities" in str(e) and "does not exist" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail={
                    "error": {
                        "code": "table_not_found",
                        "message": "saved_opportunities table not created yet. Run the migration SQL first.",
                    }
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "unsave_failed", "message": str(e)}},
        )
