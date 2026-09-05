"""
Dashboard route unit tests.

Tests the CORE LOGIC of the dashboard endpoint in isolation — no database, no network.
These tests verify:
  - Roadmap progress calculation
  - Onboarding checklist logic
  - Edge cases (no roadmap, no tasks, all complete)

Run: python -m pytest tests/unit/test_dashboard_unit.py -v
"""

from __future__ import annotations

import pytest

from app.api.routes.dashboard import _calc_roadmap_progress, _build_onboarding_checklist


# ══════════════════════════════════════════════════════════════════════════════
#  Helpers — fake ORM objects that mimic SQLAlchemy models
# ══════════════════════════════════════════════════════════════════════════════


class FakeTask:
    def __init__(self, title: str = "Task", status: str = "pending", order: int = 0):
        self.title = title
        self.status = status
        self.order = order


class FakeStep:
    def __init__(self, title: str = "Step", order: int = 0, tasks: list | None = None):
        self.title = title
        self.order = order
        self.tasks = tasks or []


class FakeRoadmap:
    def __init__(
        self,
        career_path: str = "Software Engineer",
        steps: list | None = None,
    ):
        self.career_path = career_path
        self.steps = steps or []


class FakeUser:
    def __init__(
        self,
        name: str = "Jordan",
        email: str = "jordan@test.com",
        career_path: str | None = "Software Engineer",
        interests: list | None = None,
        education_level: str | None = "student",
    ):
        self.name = name
        self.email = email
        self.career_path = career_path
        self.interests = interests or ["Technology"]
        self.education_level = education_level


# ══════════════════════════════════════════════════════════════════════════════
#  1. Roadmap Progress Calculation
# ══════════════════════════════════════════════════════════════════════════════


class TestRoadmapProgress:
    """Tests for _calc_roadmap_progress."""

    def test_partial_progress(self):
        """5 of 12 tasks complete → ~42%."""
        steps = [
            FakeStep("Step 1", 0, [
                FakeTask("T1", "complete", 0),
                FakeTask("T2", "complete", 1),
                FakeTask("T3", "complete", 2),
                FakeTask("T4", "pending", 3),
            ]),
            FakeStep("Step 2", 1, [
                FakeTask("T5", "complete", 0),
                FakeTask("T6", "pending", 1),
                FakeTask("T7", "pending", 2),
            ]),
            FakeStep("Step 3", 2, [
                FakeTask("T8", "pending", 0),
                FakeTask("T9", "pending", 1),
            ]),
            FakeStep("Step 4", 3, [
                FakeTask("T10", "pending", 0),
                FakeTask("T11", "pending", 1),
                FakeTask("T12", "pending", 2),
            ]),
        ]
        roadmap = FakeRoadmap(steps=steps)
        result = _calc_roadmap_progress(roadmap)

        assert result["has_roadmap"] is True
        assert result["total_tasks"] == 12
        assert result["completed_tasks"] == 5
        assert result["progress_percent"] == 42
        assert result["current_step"] == "Step 2"  # first incomplete step
        assert result["current_step_index"] == 1
        assert result["total_steps"] == 4

    def test_no_tasks(self):
        """Roadmap with steps but zero tasks → progress 0%."""
        steps = [
            FakeStep("Step 1", 0, []),
            FakeStep("Step 2", 1, []),
        ]
        roadmap = FakeRoadmap(steps=steps)
        result = _calc_roadmap_progress(roadmap)

        assert result["has_roadmap"] is True
        assert result["total_tasks"] == 0
        assert result["completed_tasks"] == 0
        assert result["progress_percent"] == 0
        assert result["total_steps"] == 2

    def test_all_complete(self):
        """All tasks complete → 100%, current_step is last step."""
        steps = [
            FakeStep("Step 1", 0, [
                FakeTask("T1", "complete", 0),
                FakeTask("T2", "complete", 1),
            ]),
            FakeStep("Step 2", 1, [
                FakeTask("T3", "complete", 0),
                FakeTask("T4", "complete", 1),
            ]),
        ]
        roadmap = FakeRoadmap(steps=steps)
        result = _calc_roadmap_progress(roadmap)

        assert result["progress_percent"] == 100
        assert result["completed_tasks"] == 4
        assert result["total_tasks"] == 4
        assert result["current_step"] == "Step 2"  # last step
        assert result["current_step_index"] == 1

    def test_no_roadmap_steps(self):
        """Empty roadmap (no steps) → 0% progress."""
        roadmap = FakeRoadmap(steps=[])
        result = _calc_roadmap_progress(roadmap)

        assert result["has_roadmap"] is True
        assert result["total_tasks"] == 0
        assert result["progress_percent"] == 0
        assert result["current_step"] == ""
        assert result["total_steps"] == 0

    def test_first_step_incomplete(self):
        """First step incomplete → current_step is step 0."""
        steps = [
            FakeStep("Getting Started", 0, [
                FakeTask("T1", "pending", 0),
                FakeTask("T2", "pending", 1),
            ]),
            FakeStep("Build Projects", 1, [
                FakeTask("T3", "pending", 0),
            ]),
        ]
        roadmap = FakeRoadmap(steps=steps)
        result = _calc_roadmap_progress(roadmap)

        assert result["current_step"] == "Getting Started"
        assert result["current_step_index"] == 0

    def test_step_with_mix_of_tasks(self):
        """Step with mix of complete/incomplete tasks → not complete."""
        steps = [
            FakeStep("Step 1", 0, [
                FakeTask("T1", "complete", 0),
                FakeTask("T2", "pending", 1),
            ]),
        ]
        roadmap = FakeRoadmap(steps=steps)
        result = _calc_roadmap_progress(roadmap)

        assert result["completed_tasks"] == 1
        assert result["total_tasks"] == 2
        assert result["progress_percent"] == 50


# ══════════════════════════════════════════════════════════════════════════════
#  2. Onboarding Checklist
# ══════════════════════════════════════════════════════════════════════════════


class TestOnboardingChecklist:
    """Tests for _build_onboarding_checklist."""

    def test_all_done(self):
        """All steps completed."""
        user = FakeUser(career_path="Software Engineer", interests=["Tech", "AI"])
        result = _build_onboarding_checklist(user, has_roadmap=True, has_chat=True)

        assert result["complete_profile"] is True
        assert result["start_chat"] is True
        assert result["generate_roadmap"] is True

    def test_profile_only(self):
        """Only profile completed."""
        user = FakeUser(career_path="Software Engineer", interests=["Tech"])
        result = _build_onboarding_checklist(user, has_roadmap=False, has_chat=False)

        assert result["complete_profile"] is True
        assert result["start_chat"] is False
        assert result["generate_roadmap"] is False

    def test_no_profile_no_interests(self):
        """Profile incomplete — no career path."""
        user = FakeUser(career_path=None, interests=[])
        result = _build_onboarding_checklist(user, has_roadmap=False, has_chat=False)

        assert result["complete_profile"] is False
        assert result["start_chat"] is False
        assert result["generate_roadmap"] is False

    def test_profile_no_interests(self):
        """Profile incomplete — career path set but no interests."""
        user = FakeUser(career_path="Software Engineer", interests=[])
        result = _build_onboarding_checklist(user, has_roadmap=False, has_chat=False)

        assert result["complete_profile"] is False

    def test_browse_opportunities_always_false(self):
        """browse_opportunities is always False until tracking is added."""
        user = FakeUser()
        result = _build_onboarding_checklist(user, has_roadmap=True, has_chat=True)

        assert result["browse_opportunities"] is False

    def test_roadmap_and_chat_no_profile(self):
        """Has roadmap and chat but no profile → 2/4."""
        user = FakeUser(career_path=None, interests=[])
        result = _build_onboarding_checklist(user, has_roadmap=True, has_chat=True)

        assert result["complete_profile"] is False
        assert result["start_chat"] is True
        assert result["generate_roadmap"] is True
