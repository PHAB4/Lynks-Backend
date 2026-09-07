"""
Model Router — auto-fallback LLM routing across Groq and Gemini.

Tries models in priority order. Falls back on rate limits (429).
Returns (response_text, model_name, tool_calls) from the first model that works.
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Optional

from openai import OpenAI, APIError as OpenAIError, RateLimitError
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------

@dataclass
class ModelConfig:
    name: str
    provider: str
    model: str
    base_url: str
    api_key: str
    priority: int
    max_rpm: int = 30
    max_rpd: int = 10000
    supports_tools: bool = False
    supports_vision: bool = False


# Priority order: Groq (free) → MiniMax (cheap, OpenAI-compat) → Gemini (vision fallback)
# Cheapest first. All pay-as-you-go limits.
DEFAULT_MODELS: list[dict] = [
    {
        "name": "groq-120b",
        "provider": "groq",
        "model": "openai/gpt-oss-120b",
        "base_url": "https://api.groq.com/openai/v1",
        "env_key": "LLM_API_KEY",
        "priority": 1,
        "max_rpm": 1000,
        "max_rpd": 14400,
        "supports_tools": True,
    },
    {
        "name": "groq-20b",
        "provider": "groq",
        "model": "openai/gpt-oss-20b",
        "base_url": "https://api.groq.com/openai/v1",
        "env_key": "LLM_API_KEY",
        "priority": 2,
        "max_rpm": 1000,
        "max_rpd": 14400,
        "supports_tools": True,
    },
    {
        "name": "minimax-m2.7",
        "provider": "minimax",
        "model": "MiniMax-M2.7",
        "base_url": "https://api.minimax.io/v1",
        "env_key": "MINIMAX_API_KEY",
        "priority": 3,
        "max_rpm": 60,
        "max_rpd": 10000,
        "supports_tools": True,
    },
    {
        "name": "minimax-m3",
        "provider": "minimax",
        "model": "MiniMax-M3",
        "base_url": "https://api.minimax.io/v1",
        "env_key": "MINIMAX_API_KEY",
        "priority": 4,
        "max_rpm": 60,
        "max_rpd": 10000,
        "supports_tools": True,
        "supports_vision": True,
    },
    {
        "name": "gemini-3.1-flash-lite",
        "provider": "google",
        "model": "gemini-3.1-flash-lite",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/",
        "env_key": "GEMINI_API_KEY",
        "priority": 5,
        "max_rpm": 200,
        "max_rpd": 50000,
        "supports_tools": False,
        "supports_vision": True,
    },
    {
        "name": "gemini-3.5-flash-lite",
        "provider": "google",
        "model": "gemini-3.5-flash-lite",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/",
        "env_key": "GEMINI_API_KEY",
        "priority": 6,
        "max_rpm": 150,
        "max_rpd": 50000,
        "supports_tools": False,
        "supports_vision": True,
    },
    {
        "name": "gemini-3-flash",
        "provider": "google",
        "model": "gemini-3-flash",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/",
        "env_key": "GEMINI_API_KEY",
        "priority": 7,
        "max_rpm": 150,
        "max_rpd": 50000,
        "supports_tools": False,
        "supports_vision": True,
    },
]

# ---------------------------------------------------------------------------
# Rate limit tracker (in-memory sliding window)
# ---------------------------------------------------------------------------

class RateLimitTracker:
    """Tracks per-model request counts using a sliding window."""

    def __init__(self):
        self._minute_timestamps: dict[str, list[float]] = {}
        self._day_timestamps: dict[str, list[float]] = {}
        self._permanently_limited: dict[str, float] = {}

    def can_use(self, model_name: str, max_rpm: int, max_rpd: int) -> bool:
        now = time.time()

        if model_name in self._permanently_limited:
            if now - self._permanently_limited[model_name] < 30:
                return False
            del self._permanently_limited[model_name]

        minute_ts = self._minute_timestamps.get(model_name, [])
        minute_ts = [t for t in minute_ts if now - t < 60]
        self._minute_timestamps[model_name] = minute_ts
        if len(minute_ts) >= max_rpm:
            return False

        day_ts = self._day_timestamps.get(model_name, [])
        day_ts = [t for t in day_ts if now - t < 86400]
        self._day_timestamps[model_name] = day_ts
        if len(day_ts) >= max_rpd:
            return False

        return True

    def record_usage(self, model_name: str):
        now = time.time()
        self._minute_timestamps.setdefault(model_name, []).append(now)
        self._day_timestamps.setdefault(model_name, []).append(now)

    def record_rate_limit(self, model_name: str):
        self._permanently_limited[model_name] = time.time()
        logger.warning(f"Model {model_name} rate-limited — skipping for 30 seconds")

    def get_status(self) -> dict[str, dict]:
        now = time.time()
        status = {}
        for model_cfg in DEFAULT_MODELS:
            name = model_cfg["name"]
            minute_count = len([t for t in self._minute_timestamps.get(name, []) if now - t < 60])
            day_count = len([t for t in self._day_timestamps.get(name, []) if now - t < 86400])
            limited = name in self._permanently_limited
            status[name] = {
                "requests_last_minute": minute_count,
                "requests_today": day_count,
                "permanently_limited": limited,
            }
        return status


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

_tracker = RateLimitTracker()
_clients: dict[str, OpenAI] = {}


def _get_api_key(env_key: str) -> str:
    """Resolve an API key from settings by env_key name."""
    return getattr(settings, env_key, "") or ""


def _build_model_list() -> list[ModelConfig]:
    """Build the model list from defaults, skipping models without API keys."""
    models = []
    for cfg in DEFAULT_MODELS:
        api_key = _get_api_key(cfg["env_key"])
        if not api_key:
            logger.info(f"Skipping {cfg['name']} — no API key for {cfg['env_key']}")
            continue
        models.append(ModelConfig(
            name=cfg["name"],
            provider=cfg["provider"],
            model=cfg["model"],
            base_url=cfg["base_url"],
            api_key=api_key,
            priority=cfg["priority"],
            max_rpm=cfg.get("max_rpm", 30),
            max_rpd=cfg.get("max_rpd", 10000),
            supports_tools=cfg.get("supports_tools", False),
            supports_vision=cfg.get("supports_vision", False),
        ))
    return sorted(models, key=lambda m: m.priority)


def _get_client(model: ModelConfig) -> OpenAI:
    """Get or create a cached OpenAI client for a model."""
    if model.name not in _clients:
        _clients[model.name] = OpenAI(
            api_key=model.api_key,
            base_url=model.base_url,
        )
    return _clients[model.name]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def select_model(require_tools: bool = False) -> Optional[ModelConfig]:
    """Pick the best available model, skipping rate-limited or missing-key models."""
    models = _build_model_list()
    for model in models:
        if require_tools and not model.supports_tools:
            continue
        if not _tracker.can_use(model.name, model.max_rpm, model.max_rpd):
            logger.info(f"Skipping {model.name} — rate limited")
            continue
        return model
    return None


def get_client(require_tools: bool = False) -> tuple[OpenAI, ModelConfig]:
    """Get an OpenAI client + model config for the best available model.

    Raises RuntimeError if no models are available.
    """
    model = select_model(require_tools=require_tools)
    if not model:
        raise RuntimeError("No LLM models available — all are rate-limited or missing API keys")
    return _get_client(model), model


def call_llm(
    messages: list[dict],
    tools: Optional[list[dict]] = None,
    require_tools: bool = False,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> tuple[str, str, Optional[list]]:
    """Call the LLM with automatic model fallback.

    Tries models in priority order. Falls back on 429/rate-limit errors.

    Returns:
        (response_text, model_name_used, tool_calls_or_none)
    """
    models = _build_model_list()

    for model in models:
        if require_tools and not model.supports_tools:
            logger.debug(f"Skipping {model.name} — doesn't support tools")
            continue
        if not _tracker.can_use(model.name, model.max_rpm, model.max_rpd):
            logger.info(f"Skipping {model.name} — rate limited")
            continue

        try:
            client = _get_client(model)
            kwargs = {
                "model": model.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if tools and model.supports_tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            response = client.chat.completions.create(**kwargs)
            _tracker.record_usage(model.name)

            choice = response.choices[0]
            tool_calls = choice.message.tool_calls if choice.message.tool_calls else None
            response_text = choice.message.content or ""

            logger.info(f"LLM response from {model.name} ({model.provider})")
            return response_text, model.name, tool_calls

        except RateLimitError:
            _tracker.record_rate_limit(model.name)
            logger.warning(f"Rate limited on {model.name} — trying next model")
            continue

        except OpenAIError as e:
            logger.error(f"API error on {model.name}: {e}")
            raise

    raise RuntimeError(
        "All LLM models are rate-limited or unavailable. "
        "Try again in a few minutes."
    )


def get_status() -> dict[str, dict]:
    """Get current rate limit status for all models."""
    return _tracker.get_status()
