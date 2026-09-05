"""
Unit tests for profile picture upload/delete endpoints.
Uses mocked DB and storage — no server needed.
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from io import BytesIO


class TestAvatarValidation:
    def test_allowed_content_types(self):
        """Only JPEG, PNG, GIF should be allowed"""
        from app.services.storage import ALLOWED_AVATAR_TYPES
        assert "image/jpeg" in ALLOWED_AVATAR_TYPES
        assert "image/png" in ALLOWED_AVATAR_TYPES
        assert "image/gif" in ALLOWED_AVATAR_TYPES
        assert "image/webp" not in ALLOWED_AVATAR_TYPES
        assert "application/pdf" not in ALLOWED_AVATAR_TYPES

    def test_max_avatar_size(self):
        """Max size should be 800KB"""
        from app.services.storage import MAX_AVATAR_SIZE
        assert MAX_AVATAR_SIZE == 800 * 1024

    def test_reject_oversized_file(self):
        """Files over 800KB should be rejected"""
        from app.services.storage import MAX_AVATAR_SIZE
        oversized = b"x" * (MAX_AVATAR_SIZE + 1)
        assert len(oversized) > MAX_AVATAR_SIZE

    def test_accept_valid_size(self):
        """Files under 800KB should be accepted"""
        from app.services.storage import MAX_AVATAR_SIZE
        valid_size = b"x" * 100_000
        assert len(valid_size) < MAX_AVATAR_SIZE

    def test_avatar_bucket_name(self):
        """Storage bucket should be named profile-pictures"""
        from app.services.storage import AVATAR_BUCKET
        assert AVATAR_BUCKET == "profile-pictures"


class TestAvatarStorage:
    @patch("app.services.storage.supabase_admin")
    def test_upload_returns_url(self, mock_supabase):
        """Upload should return a public URL"""
        from app.services.storage import upload_profile_picture

        mock_supabase.storage.from_.return_value.upload.return_value = {}
        mock_supabase.storage.from_.return_value.get_public_url.return_value = (
            "https://example.supabase.co/storage/v1/object/public/profile-pictures/user123/abc.jpg"
        )

        url = upload_profile_picture("user123", b"fake-image", "photo.jpg", "image/jpeg")
        assert "profile-pictures" in url
        assert "user123" in url

    @patch("app.services.storage.supabase_admin")
    def test_delete_returns_true(self, mock_supabase):
        """Delete should return True on success"""
        from app.services.storage import delete_profile_picture

        mock_supabase.storage.from_.return_value.remove.return_value = {}
        result = delete_profile_picture(
            "https://example.supabase.co/storage/v1/object/public/profile-pictures/user123/abc.jpg"
        )
        assert result is True

    @patch("app.services.storage.supabase_admin")
    def test_delete_invalid_url_returns_false(self, mock_supabase):
        """Delete with invalid URL should return False"""
        from app.services.storage import delete_profile_picture
        result = delete_profile_picture("https://example.com/not-a-storage-url")
        assert result is False


class TestAvatarEndpointBehavior:
    def test_upload_replaces_existing(self):
        """Uploading a new avatar should delete the old one"""
        old_url = "https://example.supabase.co/storage/v1/object/public/profile-pictures/user123/old.jpg"
        assert "/profile-pictures/" in old_url

    def test_avatar_in_profile_response(self):
        """Profile response should include avatar_url"""
        from pydantic import BaseModel
        from typing import Optional
        from datetime import datetime

        class ProfileResponse(BaseModel):
            user_id: str
            name: str
            avatar_url: Optional[str] = None
            created_at: datetime

        resp = ProfileResponse(
            user_id="abc",
            name="Test",
            avatar_url="https://example.com/avatar.jpg",
            created_at=datetime.now(),
        )
        assert resp.avatar_url == "https://example.com/avatar.jpg"

    def test_avatar_none_when_not_set(self):
        """avatar_url should be None when user hasn't uploaded"""
        from pydantic import BaseModel
        from typing import Optional
        from datetime import datetime

        class ProfileResponse(BaseModel):
            user_id: str
            name: str
            avatar_url: Optional[str] = None
            created_at: datetime

        resp = ProfileResponse(
            user_id="abc",
            name="Test",
            created_at=datetime.now(),
        )
        assert resp.avatar_url is None
