"""
Rate limiting and security headers middleware for Lynks Backend.

Rate limiting: in-memory sliding window per IP, configurable per endpoint group.
Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, etc.
"""

from __future__ import annotations

import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


# ── Rate Limiting ──────────────────────────────────────────────────────────

# Endpoint groups with their limits: (max_requests, window_seconds)
RATE_LIMITS: dict[str, tuple[int, int]] = {
    "llm":   (10, 60),   # 10 requests per minute — LLM endpoints are expensive
    "auth":  (20, 60),   # 20 per minute — auth flows
    "default": (60, 60), # 60 per minute — everything else
}

# Map path prefixes to rate limit groups
LLM_PATHS = ("/chat/message", "/roadmap/generate", "/roadmap/regenerate", "/opportunities")
AUTH_PATHS = ("/auth",)


def _get_group(path: str) -> str:
    for prefix in LLM_PATHS:
        if path.startswith(prefix):
            return "llm"
    for prefix in AUTH_PATHS:
        if path.startswith(prefix):
            return "auth"
    return "default"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding window rate limiter keyed by client IP."""

    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        group = _get_group(request.url.path)
        max_requests, window = RATE_LIMITS[group]
        key = f"{client_ip}:{group}"

        now = time.time()
        cutoff = now - window

        # Prune old entries
        self._hits[key] = [t for t in self._hits[key] if t > cutoff]

        if len(self._hits[key]) >= max_requests:
            retry_after = int(self._hits[key][0] - cutoff) + 1
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."},
                headers={"Retry-After": str(retry_after)},
            )

        self._hits[key].append(now)
        return await call_next(request)


# ── Security Headers ───────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to all responses."""

    HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    }

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for key, value in self.HEADERS.items():
            response.headers[key] = value
        return response
