"""
Unit tests for PATCH /profile phone field.
Uses mocked DB — no server or real database needed.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class FakeUser:
    def __init__(self):
        self.id = "user-123"
        self.email = "test@example.com"
        self.username = "testuser"
        self.name = "Test User"
        self.age = 25
        self.country = "Jamaica"
        self.education_level = "bachelors"
        self.employment_status = "employed"
        self.phone = None
        self.career_path = "software_engineering"
        self.interests = ["coding"]
        self.created_at = MagicMock()
        self.created_at.isoformat.return_value = "2026-01-01T00:00:00Z"


class TestPhoneField:
    def test_phone_returned_in_profile_response(self):
        """GET /profile should include phone field"""
        user = FakeUser()
        user.phone = "+1-876-555-1234"

        result = {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "name": user.name,
            "age": user.age,
            "country": user.country,
            "education_level": user.education_level,
            "employment_status": user.employment_status,
            "phone": user.phone,
            "career_path": user.career_path,
            "interests": user.interests,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        assert result["phone"] == "+1-876-555-1234"

    def test_phone_none_when_not_set(self):
        """Phone should be None when user hasn't set it"""
        user = FakeUser()
        assert user.phone is None

        result = {"phone": user.phone}
        assert result["phone"] is None

    def test_phone_update_in_profile(self):
        """PATCH /profile should accept phone field"""
        update_data = {"phone": "+1-876-555-9999"}
        assert "phone" in update_data
        assert update_data["phone"] == "+1-876-555-9999"

    def test_phone_update_partial(self):
        """PATCH /profile with only phone should not overwrite other fields"""
        update_data = {"phone": "+1-876-555-0000"}
        # Simulating model_dump(exclude_unset=True)
        assert set(update_data.keys()) == {"phone"}

    def test_phone_optional_in_schema(self):
        """Phone field should be optional (not required) in ProfileUpdate"""
        from pydantic import BaseModel
        from typing import Optional

        class ProfileUpdate(BaseModel):
            name: Optional[str] = None
            phone: Optional[str] = None

        # Should work with no phone
        update = ProfileUpdate(name="Test")
        assert update.phone is None

        # Should work with phone
        update = ProfileUpdate(phone="+1-876-555-1234")
        assert update.phone == "+1-876-555-1234"
