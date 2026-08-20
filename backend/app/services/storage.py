"""
File upload service — Supabase Storage integration.

Handles uploading files to Supabase Storage and returning public URLs.
Uses the Supabase Python client's storage API.

Setup required:
  1. In Supabase Dashboard -> Storage -> Create bucket named "evidence"
  2. Set bucket to public (or configure RLS policies)
  3. No extra env vars needed — uses the existing SUPABASE_URL + SUPABASE_ANON_KEY
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from app.core.config import supabase

logger = logging.getLogger(__name__)

BUCKET_NAME = "evidence"


def upload_evidence_file(file_bytes: bytes, filename: str, file_type: str) -> str:
    """
    Upload a file to Supabase Storage and return the public URL.

    File is stored at: evidence/{uuid}.{ext}
    Returns: public URL string
    """
    ext = Path(filename).suffix.lower()
    unique_name = f"{uuid.uuid4()}{ext}"

    result = supabase.storage.from_(BUCKET_NAME).upload(
        path=unique_name,
        file=file_bytes,
        file_options={"content-type": file_type},
    )

    public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(unique_name)

    logger.info("Uploaded evidence file: %s -> %s", filename, unique_name)
    return public_url


def delete_evidence_file(file_url: str) -> bool:
    """
    Delete a file from Supabase Storage given its public URL.
    """
    try:
        parts = file_url.split(f"/{BUCKET_NAME}/")
        if len(parts) < 2:
            logger.warning("Could not extract file path from URL: %s", file_url)
            return False

        file_path = parts[1]
        supabase.storage.from_(BUCKET_NAME).remove(file_path)
        logger.info("Deleted evidence file: %s", file_path)
        return True
    except Exception as e:
        logger.error("Failed to delete evidence file: %s", e)
        return False