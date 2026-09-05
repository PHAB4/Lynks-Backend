"""
Tests for the evidence verification system.

All Gemini API calls are mocked — no real API calls in tests.
Covers: verify_evidence, verify_and_update_evidence, re-verify, and error paths.
"""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.verifier import verify_evidence


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_certificate_pass(mock_client):
    """Valid certificate → verified=True, high confidence."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "high",
        "document_type": "certificate",
        "issuer": "Coursera",
        "reason": "Legitimate Coursera certificate for Python course",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"fake-image-bytes",
        mime_type="image/jpeg",
        career_path="Software Development",
        task_title="Complete Python Fundamentals",
    )

    assert result["verified"] is True
    assert result["confidence"] == "high"
    assert result["document_type"] == "certificate"
    assert result["issuer"] == "Coursera"
    assert "Coursera" in result["reason"]


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_reject_blank_image(mock_client):
    """Blank image → verified=False."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": False,
        "confidence": "high",
        "document_type": "unknown",
        "issuer": None,
        "reason": "Image is a blank white rectangle with no content",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"blank-image",
        mime_type="image/png",
        career_path="Software Development",
        task_title="Complete Python Fundamentals",
    )

    assert result["verified"] is False
    assert result["confidence"] == "high"
    assert result["issuer"] is None


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_reject_unrelated(mock_client):
    """Random meme → verified=False."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": False,
        "confidence": "medium",
        "document_type": "unknown",
        "issuer": None,
        "reason": "Image appears to be a social media meme, not career evidence",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"meme-image",
        mime_type="image/jpeg",
        career_path="Software Development",
        task_title="Complete Python Fundamentals",
    )

    assert result["verified"] is False


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_with_career_context(mock_client):
    """Python cert for software dev → verified, relevant."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "high",
        "document_type": "certificate",
        "issuer": "Udemy",
        "reason": "Python certificate directly relevant to Software Development career path",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"python-cert",
        mime_type="image/png",
        career_path="Software Development",
        task_title="Learn Python Basics",
    )

    assert result["verified"] is True
    # Verify career context was passed in the call
    call_args = mock_client.models.generate_content.call_args
    contents = call_args.kwargs.get("contents") or call_args[1].get("contents")
    prompt_text = str(contents)
    assert "Software Development" in prompt_text
    assert "Learn Python Basics" in prompt_text


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_reject_wrong_career(mock_client):
    """Cooking cert for software dev → still lenient, but low confidence."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "low",
        "document_type": "certificate",
        "issuer": "Culinary Institute",
        "reason": "Legitimate certificate but tangentially related to career path",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"cooking-cert",
        mime_type="image/jpeg",
        career_path="Software Development",
        task_title="Complete a cooking workshop",
    )

    # Lenient: verifies it's real, but flags low confidence
    assert result["verified"] is True
    assert result["confidence"] == "low"


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_invalid_json_response(mock_client):
    """LLM returns garbage → graceful fallback."""
    mock_response = MagicMock()
    mock_response.text = "I'm sorry, I can't analyze that image."
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"some-image",
        mime_type="image/jpeg",
        career_path="Software Development",
        task_title="Complete Python course",
    )

    assert result["verified"] is False
    assert result["confidence"] == "low"
    assert "error" in result["reason"].lower() or "unable" in result["reason"].lower()


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_api_timeout(mock_client):
    """Gemini API raises exception → RuntimeError propagates to caller."""
    mock_client.models.generate_content.side_effect = Exception("Connection timeout")

    with pytest.raises(RuntimeError, match="Verification failed"):
        await verify_evidence(
            image_bytes=b"some-image",
            mime_type="image/jpeg",
            career_path="Software Development",
            task_title="Complete Python course",
        )


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_pdf_type(mock_client):
    """PDF files are handled correctly."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "medium",
        "document_type": "certificate",
        "issuer": "AWS",
        "reason": "AWS Solutions Architect certificate (PDF format)",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"pdf-content",
        mime_type="application/pdf",
        career_path="Cloud Engineering",
        task_title="Get AWS certification",
    )

    assert result["verified"] is True
    assert result["confidence"] == "medium"


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_returns_all_fields(mock_client):
    """Verify the response always has all 5 keys."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "high",
        "document_type": "badge",
        "issuer": "freeCodeCamp",
        "reason": "Valid freeCodeCamp JavaScript badge",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"badge-image",
        mime_type="image/png",
        career_path="Web Development",
        task_title="Complete JavaScript challenges",
    )

    assert "verified" in result
    assert "confidence" in result
    assert "document_type" in result
    assert "issuer" in result
    assert "reason" in result
    assert len(result) == 5


# ── verify_and_update_evidence tests ────────────────────────────────────────


def _make_evidence(evidence_id="ev-123", user_id="user-1", task_id="task-1", status="pending"):
    """Create a mock Evidence object for unit tests."""
    ev = MagicMock()
    ev.id = evidence_id
    ev.user_id = user_id
    ev.task_id = task_id
    ev.verification_status = status
    ev.verification_reason = None
    ev.verification_confidence = None
    ev.verified_at = None
    return ev


@pytest.mark.asyncio
@patch("app.agents.portfolio_manager.verify_evidence", new_callable=AsyncMock)
@patch("app.agents.verifier.client")
async def test_verify_and_update_sets_rejected(mock_client, mock_verify):
    """verified=False → verification_status = 'rejected'."""
    from app.agents.portfolio_manager import verify_and_update_evidence

    mock_verify.return_value = {
        "verified": False,
        "confidence": "high",
        "document_type": "unknown",
        "issuer": None,
        "reason": "Blank image",
    }

    db = AsyncMock()
    evidence = _make_evidence()
    db.get.return_value = evidence

    result = await verify_and_update_evidence(
        db=db,
        evidence_id="ev-123",
        image_bytes=b"img",
        mime_type="image/png",
        career_path="Software Dev",
        task_title="Learn Python",
    )

    assert result.verification_status == "rejected"
    assert result.verification_reason == "Blank image"
    assert result.verification_confidence == "high"
    assert result.verified_at is not None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@patch("app.agents.portfolio_manager.verify_evidence", new_callable=AsyncMock)
@patch("app.agents.verifier.client")
async def test_verify_and_update_sets_verified(mock_client, mock_verify):
    """verified=True → verification_status = 'verified'."""
    from app.agents.portfolio_manager import verify_and_update_evidence

    mock_verify.return_value = {
        "verified": True,
        "confidence": "high",
        "document_type": "certificate",
        "issuer": "Coursera",
        "reason": "Legitimate certificate",
    }

    db = AsyncMock()
    evidence = _make_evidence()
    db.get.return_value = evidence

    result = await verify_and_update_evidence(
        db=db,
        evidence_id="ev-123",
        image_bytes=b"img",
        mime_type="image/jpeg",
        career_path="Software Dev",
        task_title="Learn Python",
    )

    assert result.verification_status == "verified"
    assert result.verification_reason == "Legitimate certificate"
    assert result.verification_confidence == "high"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@patch("app.agents.portfolio_manager.verify_evidence", new_callable=AsyncMock)
@patch("app.agents.verifier.client")
async def test_verify_and_update_db_commit_fails(mock_client, mock_verify):
    """DB commit fails → evidence stays in original state, error propagates."""
    from app.agents.portfolio_manager import verify_and_update_evidence

    mock_verify.return_value = {
        "verified": True,
        "confidence": "high",
        "document_type": "certificate",
        "issuer": "Udemy",
        "reason": "Valid",
    }

    db = AsyncMock()
    evidence = _make_evidence()
    db.get.return_value = evidence
    db.commit.side_effect = Exception("Database connection lost")

    with pytest.raises(Exception, match="Database connection lost"):
        await verify_and_update_evidence(
            db=db,
            evidence_id="ev-123",
            image_bytes=b"img",
            mime_type="image/png",
            career_path="Software Dev",
            task_title="Learn Python",
        )

    # Evidence fields were set before the commit failed
    assert evidence.verification_status == "verified"
    assert evidence.verified_at is not None


@pytest.mark.asyncio
@patch("app.agents.portfolio_manager.verify_evidence", new_callable=AsyncMock)
@patch("app.agents.verifier.client")
async def test_verify_and_update_evidence_not_found(mock_client, mock_verify):
    """Evidence ID doesn't exist → ValueError raised."""
    from app.agents.portfolio_manager import verify_and_update_evidence

    mock_verify.return_value = {
        "verified": True,
        "confidence": "high",
        "document_type": "certificate",
        "issuer": "Test",
        "reason": "Valid",
    }

    db = AsyncMock()
    db.get.return_value = None  # Evidence not found

    with pytest.raises(ValueError, match="evidence_not_found"):
        await verify_and_update_evidence(
            db=db,
            evidence_id="nonexistent",
            image_bytes=b"img",
            mime_type="image/png",
            career_path="Software Dev",
            task_title="Learn Python",
        )

    db.commit.assert_not_awaited()


# ── Re-verify edge cases ────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.agents.portfolio_manager.verify_evidence", new_callable=AsyncMock)
@patch("app.agents.verifier.client")
async def test_reverify_pending_evidence(mock_client, mock_verify):
    """Re-verifying evidence that is still 'pending' should work fine."""
    from app.agents.portfolio_manager import verify_and_update_evidence

    mock_verify.return_value = {
        "verified": True,
        "confidence": "medium",
        "document_type": "screenshot",
        "issuer": None,
        "reason": "Looks like a valid completion screenshot",
    }

    db = AsyncMock()
    evidence = _make_evidence(status="pending")
    db.get.return_value = evidence

    result = await verify_and_update_evidence(
        db=db,
        evidence_id="ev-123",
        image_bytes=b"img",
        mime_type="image/png",
        career_path="Software Dev",
        task_title="Build a project",
    )

    assert result.verification_status == "verified"
    assert result.verification_confidence == "medium"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@patch("app.agents.portfolio_manager.verify_evidence", new_callable=AsyncMock)
@patch("app.agents.verifier.client")
async def test_reverify_gemini_failure(mock_client, mock_verify):
    """Gemini errors during re-verify → RuntimeError propagates, status stays pending."""
    from app.agents.portfolio_manager import verify_and_update_evidence

    mock_verify.side_effect = RuntimeError("Verification failed: API timeout")

    db = AsyncMock()
    evidence = _make_evidence(status="pending")
    db.get.return_value = evidence

    with pytest.raises(RuntimeError, match="Verification failed"):
        await verify_and_update_evidence(
            db=db,
            evidence_id="ev-123",
            image_bytes=b"img",
            mime_type="image/png",
            career_path="Software Dev",
            task_title="Learn Python",
        )

    # Status should NOT have been changed — Gemini failed before writing
    assert evidence.verification_status == "pending"
    db.commit.assert_not_awaited()


# ── Route-level error handling ──────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.agents.portfolio_manager.verify_and_update_evidence", new_callable=AsyncMock)
@patch("app.services.storage.upload_evidence_file")
@patch("app.agents.portfolio_manager.save_evidence", new_callable=AsyncMock)
async def test_upload_continues_when_verification_fails(mock_save, mock_upload, mock_verify):
    """If verification throws, upload still returns evidence with 'pending' status."""
    from fastapi import Request
    from fastapi.datastructures import UploadFile
    from io import BytesIO

    from app.api.routes.portfolio import post_task_evidence

    mock_upload.return_value = "https://storage.example.com/file.jpg"

    evidence = _make_evidence()
    evidence.file_url = "https://storage.example.com/file.jpg"
    evidence.file_type = "image/jpeg"
    evidence.verification_status = "pending"
    mock_save.return_value = evidence

    mock_verify.side_effect = RuntimeError("Gemini is down")

    # Build a fake UploadFile — content_type is read from headers in this Starlette version
    from starlette.datastructures import Headers
    file = UploadFile(
        filename="cert.jpg",
        file=BytesIO(b"fake-image-data"),
        headers=Headers({"content-type": "image/jpeg"}),
    )

    db = AsyncMock()
    user_id = "user-1"

    # The route catches RuntimeError and still returns evidence
    response = await post_task_evidence(
        task_id="task-1",
        file_type="image/jpeg",
        file=file,
        user_id=user_id,
        db=db,
    )

    # Evidence returned with pending status — verification failure is non-fatal
    assert response["verification_status"] == "pending"
    assert response["id"] == "ev-123"


# ── Extra keys in LLM response ─────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_extra_keys_ignored(mock_client):
    """Extra unknown keys in LLM response are stripped gracefully."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "high",
        "document_type": "certificate",
        "issuer": "Coursera",
        "reason": "Valid",
        "extra_field": "should be ignored",
        "another_noise": 42,
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"img",
        mime_type="image/jpeg",
        career_path="Software Dev",
        task_title="Learn Python",
    )

    # Should only have the 5 expected keys — no extras
    assert len(result) == 5
    assert "extra_field" not in result
    assert "another_noise" not in result
    assert result["verified"] is True
