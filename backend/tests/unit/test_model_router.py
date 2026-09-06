"""
Unit tests for the Model Router.

Tests rate limit tracking, model selection, call_llm fallback, and error handling.
No real API calls — all OpenAI clients are mocked.
"""

from __future__ import annotations

import os
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("LLM_API_KEY", "test-groq-key")
os.environ.setdefault("LLM_API_BASE_URL", "https://api.groq.com/openai/v1")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")

import time
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from openai import RateLimitError, APIStatusError

from app.services.model_router import (
    ModelConfig,
    RateLimitTracker,
    _build_model_list,
    _get_api_key,
    select_model,
    call_llm,
    get_status,
    _tracker,
)


# ── RateLimitTracker tests ─────────────────────────────────────────────────


class TestRateLimitTracker:
    def test_can_use_within_limits(self):
        tracker = RateLimitTracker()
        assert tracker.can_use("test-model", max_rpm=30, max_rpd=1000) is True

    def test_rate_limits_after_max_rpm(self):
        tracker = RateLimitTracker()
        for _ in range(10):
            tracker.record_usage("test-model")
        assert tracker.can_use("test-model", max_rpm=10, max_rpd=10000) is False

    def test_rate_limits_after_max_rpd(self):
        tracker = RateLimitTracker()
        for _ in range(100):
            tracker.record_usage("test-model")
        assert tracker.can_use("test-model", max_rpm=1000, max_rpd=100) is False

    def test_permanently_limited_blocks_model(self):
        tracker = RateLimitTracker()
        tracker.record_rate_limit("test-model")
        assert tracker.can_use("test-model", max_rpm=1000, max_rpd=10000) is False

    def test_permanent_limit_expires_after_30_seconds(self):
        tracker = RateLimitTracker()
        tracker.record_rate_limit("test-model")
        # Simulate 31 seconds passing
        tracker._permanently_limited["test-model"] = time.time() - 31
        assert tracker.can_use("test-model", max_rpm=1000, max_rpd=10000) is True

    def test_per_model_isolation(self):
        tracker = RateLimitTracker()
        for _ in range(10):
            tracker.record_usage("model-a")
        assert tracker.can_use("model-a", max_rpm=10, max_rpd=1000) is False
        assert tracker.can_use("model-b", max_rpm=10, max_rpd=1000) is True

    def test_get_status(self):
        tracker = RateLimitTracker()
        tracker.record_usage("groq-120b")
        tracker.record_rate_limit("groq-20b")
        status = tracker.get_status()
        assert status["groq-120b"]["requests_last_minute"] == 1
        assert status["groq-20b"]["permanently_limited"] is True


# ── Model list tests ───────────────────────────────────────────────────────


class TestModelList:
    def test_builds_list_with_keys(self):
        models = _build_model_list()
        names = [m.name for m in models]
        assert "groq-120b" in names
        assert "groq-20b" in names
        assert "gemini-3.1-flash-lite" in names
        assert "gemini-3.5-flash-lite" in names
        assert "gemini-3-flash" in names

    def test_sorted_by_priority(self):
        models = _build_model_list()
        priorities = [m.priority for m in models]
        assert priorities == sorted(priorities)

    def test_skips_models_without_api_keys(self):
        with patch("app.services.model_router._get_api_key") as mock:
            mock.return_value = ""
            models = _build_model_list()
            assert len(models) == 0

    def test_gemini_models_use_correct_base_url(self):
        models = _build_model_list()
        gemini_models = [m for m in models if m.provider == "google"]
        for m in gemini_models:
            assert "generativelanguage.googleapis.com" in m.base_url

    def test_groq_models_use_correct_base_url(self):
        models = _build_model_list()
        groq_models = [m for m in models if m.provider == "groq"]
        for m in groq_models:
            assert "api.groq.com" in m.base_url

    def test_groq_models_support_tools(self):
        models = _build_model_list()
        groq_models = [m for m in models if m.provider == "groq"]
        for m in groq_models:
            assert m.supports_tools is True

    def test_gemini_models_do_not_support_tools(self):
        models = _build_model_list()
        gemini_models = [m for m in models if m.provider == "google"]
        for m in gemini_models:
            assert m.supports_tools is False


# ── Model selection tests ──────────────────────────────────────────────────


class TestSelectModel:
    def setup_method(self):
        _tracker._minute_timestamps.clear()
        _tracker._day_timestamps.clear()
        _tracker._permanently_limited.clear()

    def test_selects_first_available(self):
        model = select_model()
        assert model is not None
        assert model.name == "groq-120b"

    def test_skips_rate_limited_model(self):
        _tracker.record_rate_limit("groq-120b")
        model = select_model()
        assert model is not None
        assert model.name == "groq-20b"

    def test_require_tools_skips_gemini(self):
        _tracker.record_rate_limit("groq-120b")
        _tracker.record_rate_limit("groq-20b")
        model = select_model(require_tools=True)
        assert model is None  # Gemini doesn't support tools

    def test_require_tools_picks_groq(self):
        model = select_model(require_tools=True)
        assert model is not None
        assert model.supports_tools is True

    def test_returns_none_when_all_limited(self):
        for name in ["groq-120b", "groq-20b", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3-flash"]:
            _tracker.record_rate_limit(name)
        model = select_model()
        assert model is None


# ── call_llm tests ─────────────────────────────────────────────────────────


class TestCallLlm:
    def setup_method(self):
        _tracker._minute_timestamps.clear()
        _tracker._day_timestamps.clear()
        _tracker._permanently_limited.clear()

    def test_success_path(self):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hello from Groq"
        mock_response.choices[0].message.tool_calls = None

        with patch("app.services.model_router._get_client") as mock:
            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock.return_value = mock_client

            text, model_used, tool_calls = call_llm(
                messages=[{"role": "user", "content": "Hi"}]
            )

        assert text == "Hello from Groq"
        assert model_used == "groq-120b"
        assert tool_calls is None

    def test_fallback_on_rate_limit(self):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hello from fallback"
        mock_response.choices[0].message.tool_calls = None

        call_count = 0

        def mock_get_client(require_tools=False):
            nonlocal call_count
            call_count += 1
            client = MagicMock()
            if call_count == 1:
                client.chat.completions.create.side_effect = RateLimitError(
                    message="rate limited",
                    response=MagicMock(status_code=429, headers={}),
                    body=None,
                )
            else:
                client.chat.completions.create.return_value = mock_response
            return client

        with patch("app.services.model_router._get_client", side_effect=mock_get_client):
            with patch("app.services.model_router._build_model_list") as mock_list:
                m1 = ModelConfig("groq-120b", "groq", "openai/gpt-oss-120b", "https://api.groq.com/openai/v1", "key1", 1, supports_tools=True)
                m2 = ModelConfig("groq-20b", "groq", "openai/gpt-oss-20b", "https://api.groq.com/openai/v1", "key1", 2, supports_tools=True)
                mock_list.return_value = [m1, m2]

                text, model_used, tool_calls = call_llm(
                    messages=[{"role": "user", "content": "Hi"}]
                )

        assert text == "Hello from fallback"
        assert model_used == "groq-20b"

    def test_all_models_exhausted(self):
        with patch("app.services.model_router._build_model_list") as mock_list:
            m1 = ModelConfig("groq-120b", "groq", "model", "url", "key", 1, supports_tools=True)
            mock_list.return_value = [m1]

            with patch("app.services.model_router._get_client") as mock:
                client = MagicMock()
                client.chat.completions.create.side_effect = RateLimitError(
                    message="rate limited",
                    response=MagicMock(status_code=429, headers={}),
                    body=None,
                )
                mock.return_value = client

                with pytest.raises(RuntimeError, match="All LLM models"):
                    call_llm(messages=[{"role": "user", "content": "Hi"}])

    def test_tool_calls_returned(self):
        mock_tool_call = MagicMock()
        mock_tool_call.id = "call_123"
        mock_tool_call.function.name = "generate_roadmap"
        mock_tool_call.function.arguments = "{}"

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = None
        mock_response.choices[0].message.tool_calls = [mock_tool_call]

        with patch("app.services.model_router._get_client") as mock:
            client = MagicMock()
            client.chat.completions.create.return_value = mock_response
            mock.return_value = client

            text, model_used, tool_calls = call_llm(
                messages=[{"role": "user", "content": "Generate my roadmap"}],
                tools=[{"type": "function", "function": {"name": "generate_roadmap"}}],
                require_tools=True,
            )

        assert tool_calls is not None
        assert len(tool_calls) == 1
        assert tool_calls[0].function.name == "generate_roadmap"

    def test_non_rate_limit_api_error_raises(self):
        with patch("app.services.model_router._build_model_list") as mock_list:
            m1 = ModelConfig("groq-120b", "groq", "model", "url", "key", 1, supports_tools=True)
            mock_list.return_value = [m1]

            with patch("app.services.model_router._get_client") as mock:
                client = MagicMock()
                client.chat.completions.create.side_effect = APIStatusError(
                    message="bad request",
                    response=MagicMock(status_code=400, headers={}),
                    body=None,
                )
                mock.return_value = client

                with pytest.raises(APIStatusError):
                    call_llm(messages=[{"role": "user", "content": "Hi"}])


# ── Status tests ───────────────────────────────────────────────────────────


class TestGetStatus:
    def test_status_returns_all_models(self):
        status = get_status()
        assert "groq-120b" in status
        assert "groq-20b" in status
        assert "gemini-3.1-flash-lite" in status
        assert "gemini-3.5-flash-lite" in status
        assert "gemini-3-flash" in status

    def test_status_shape(self):
        status = get_status()
        for name, info in status.items():
            assert "requests_last_minute" in info
            assert "requests_today" in info
            assert "permanently_limited" in info
