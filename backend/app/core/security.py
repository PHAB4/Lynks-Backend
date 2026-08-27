"""
JWT verification — verifies Supabase-issued tokens.
Does NOT issue tokens or hash passwords.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client
from supabase_auth.errors import AuthApiError

from app.core.config import settings


security = HTTPBearer()

_supabase_client: Client | None = None


def get_supabase() -> Client:
    """Lazy-init Supabase client with service role key (for backend use)."""
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client

        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY,
        )
    return _supabase_client


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    Verify the Supabase JWT and return the user's UUID string.
    Raises 401 if the token is missing or invalid.
    """
    token = credentials.credentials
    supabase = get_supabase()

    try:
        response = supabase.auth.get_user(token)
    except (AuthApiError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthorized", "message": "Invalid or expired token"}},
        )

    if not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthorized", "message": "Invalid or expired token"}},
        )

    return response.user.id
