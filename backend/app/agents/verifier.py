"""
Evidence Verifier — uses Google Gemini 2.5 Flash for vision-based
verification of uploaded certificates, badges, and project evidence.

This is the ONLY file that imports from google-genai. All other code
interacts with this module through verify_evidence().
"""

from __future__ import annotations

import base64
import json
import logging

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

VERIFICATION_PROMPT = """\
You are the Lynks Evidence Verifier — an AI that verifies whether uploaded
files are legitimate proof of task completion for a Caribbean career platform.

TASK CONTEXT:
- User's career path: {career_path}
- Task title: {task_title}
- Task description: {task_description}

Analyze the uploaded image and determine:

1. DOCUMENT TYPE: Is this a certificate, badge, completion screenshot,
   project demo, award letter, or other evidence? Or is it a generic,
   unrelated, blank, or fake image?

2. CONTENT LEGITIMACY:
   - Does it have realistic elements? (issuer name, date, recipient name,
     completion details, logo, signatures)
   - Does it look authentic or obviously fabricated?
   - If it's a screenshot, does it look like a real platform?

3. CAREER RELEVANCE:
   - Does this evidence relate to the user's career path ({career_path})?
   - Does it relate to the specific task they're completing ({task_title})?

BE LENIENT: If it looks like a reasonable screenshot of a completed course,
certificate, project, or workshop — verify it. Only reject obviously fake,
blank, or completely unrelated images.

Return ONLY a JSON object (no markdown, no code fences):
{{
  "verified": true,
  "confidence": "high",
  "document_type": "certificate",
  "issuer": "Coursera",
  "reason": "Legitimate Coursera certificate for Python course completion"
}}

{{
  "verified": false,
  "confidence": "medium",
  "document_type": "unknown",
  "issuer": null,
  "reason": "Image appears to be a blank white rectangle with no visible content"
}}
"""


async def verify_evidence(
    image_bytes: bytes,
    mime_type: str,
    career_path: str,
    task_title: str,
    task_description: str = "",
) -> dict:
    """
    Send an uploaded image to Gemini Flash for verification.

    Args:
        image_bytes: Raw bytes of the uploaded file.
        mime_type: MIME type (e.g. "image/jpeg", "image/png", "image/webp").
        career_path: The user's chosen career path.
        task_title: The title of the task being completed.
        task_description: Optional task description for extra context.

    Returns:
        dict with keys: verified, confidence, document_type, issuer, reason
    """
    base64_data = base64.b64encode(image_bytes).decode("utf-8")

    prompt = VERIFICATION_PROMPT.format(
        career_path=career_path,
        task_title=task_title,
        task_description=task_description or "No additional description.",
    )

    try:
        response = client.models.generate_content(
            model=settings.VISION_MODEL,
            contents=[
                types.Part.from_bytes(
                    data=base64.b64decode(base64_data),
                    mime_type=mime_type,
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=500,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        result = json.loads(raw_text)

        return {
            "verified": bool(result.get("verified", False)),
            "confidence": result.get("confidence", "low"),
            "document_type": result.get("document_type", "unknown"),
            "issuer": result.get("issuer"),
            "reason": result.get("reason", "No reason provided"),
        }

    except json.JSONDecodeError as e:
        logger.error("Gemini returned invalid JSON for evidence verification: %s", e)
        return {
            "verified": False,
            "confidence": "low",
            "document_type": "unknown",
            "issuer": None,
            "reason": "Verification system error — unable to parse response",
        }

    except Exception as e:
        logger.error("Evidence verification failed: %s", e)
        raise RuntimeError(f"Verification failed: {e}")
