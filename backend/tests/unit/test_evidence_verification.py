"""
Tests for the evidence verification system.

All Gemini API calls are mocked — no real API calls in tests.
"""

import json
from unittest.mock import MagicMock, patch

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
