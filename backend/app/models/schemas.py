"""
Pydantic request/response schemas — matches API_CONTRACT.md exactly.
Field names are snake_case; every id is a uuid string.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Error ──────────────────────────────────────────────────────────────────


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


# ── Profile ────────────────────────────────────────────────────────────────


class ProfileResponse(BaseModel):
    user_id: str = Field(..., description="UUID")
    username: str
    name: str
    email: str
    age: int
    country: str
    education_level: str
    employment_status: str
    phone: str | None = None
    career_path: str
    interests: list[str]
    created_at: datetime


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    country: Optional[str] = None
    education_level: Optional[str] = None
    employment_status: Optional[str] = None
    phone: Optional[str] = None
    interests: Optional[list[str]] = None


class CareerPathUpdate(BaseModel):
    career_path: str


# ── Roadmap ────────────────────────────────────────────────────────────────


class TaskResponse(BaseModel):
    task_id: str = Field(..., description="UUID")
    title: str
    description: str
    order: int
    status: str = Field(..., description="pending | complete")


class TaskDetailResponse(BaseModel):
    task_id: str = Field(..., description="UUID")
    step_id: str = Field(..., description="UUID")
    title: str
    description: str
    order: int
    status: str = Field(..., description="pending | complete")


class StepResponse(BaseModel):
    step_id: str = Field(..., description="UUID")
    title: str
    description: str
    order: int
    status: str = Field(..., description="pending | complete — computed from child tasks")
    tasks: list[TaskResponse]


class RoadmapResponse(BaseModel):
    roadmap_id: str = Field(..., description="UUID")
    steps: list[StepResponse]


# ── Portfolio / Evidence ───────────────────────────────────────────────────


class EvidenceResponse(BaseModel):
    id: str = Field(..., description="UUID")
    file_url: str
    file_type: str
    verification_status: str = Field(..., description="pending | verified | rejected")
    uploaded_at: datetime


class TaskEvidenceResponse(BaseModel):
    task_id: str = Field(..., description="UUID")
    title: str
    evidence: list[EvidenceResponse]


class TaskCompleteResponse(BaseModel):
    task_id: str = Field(..., description="UUID")
    status: str = Field(..., description="complete")


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, description="New title for the task")
    description: Optional[str] = Field(None, description="New description for the task")
    status: Optional[str] = Field(None, description="pending | in_progress | complete")


class TaskUpdateResponse(BaseModel):
    success: bool
    task_id: str = Field(..., description="UUID")
    title: str
    status: str
    message: str


# ── Resume ─────────────────────────────────────────────────────────────────


class ResumeResponse(BaseModel):
    resume_id: str = Field(..., description="UUID")
    content: str | dict


class ResumeUpdate(BaseModel):
    content: str | dict


# ── Opportunities ──────────────────────────────────────────────────────────


class OpportunityResponse(BaseModel):
    id: str
    title: str
    company: str
    location: str
    description: str = ""
    category: str = "event"
    pay: str
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: Optional[str] = None
    age_requirement: Optional[str] = None
    experience_required: str
    url: str
    posted_at: Optional[str] = None
    first_seen_at: Optional[str] = None
    source_name: str = "curated"
    image_url: Optional[str] = None
    is_saved: bool = False
    relevance_score: Optional[float] = None


class OpportunityMetadata(BaseModel):
    total_available: int
    returned: int
    page: int
    limit: int
    has_more: bool
    available_categories: list[str]
    filters_applied: dict


class OpportunityListResponse(BaseModel):
    opportunities: list[OpportunityResponse]
    metadata: OpportunityMetadata


class NewCountResponse(BaseModel):
    new_count: int
    new_since: str


class SaveOpportunityResponse(BaseModel):
    success: bool
    saved_at: Optional[str] = None


class SavedOpportunitiesResponse(BaseModel):
    saved: list[OpportunityResponse]
    total: int


# ── Notifications ──────────────────────────────────────────────────────────


class NotificationCreate(BaseModel):
    title: str
    body: str
    type: str = "info"
    link: Optional[str | dict] = None


class NotificationResponse(BaseModel):
    id: str = Field(..., description="UUID")
    title: str
    body: str
    type: str
    link: Optional[str | dict] = None
    is_read: bool = False
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int


# ── Chat ───────────────────────────────────────────────────────────────────


class ChatMessageRequest(BaseModel):
    conversation_id: Optional[str] = Field(None, description="UUID — omit to start new")
    message: str


class ChatMessageResponse(BaseModel):
    conversation_id: str = Field(..., description="UUID")
    response: str
    tool_calls: Optional[list[dict]] = None


class ChatHistoryItem(BaseModel):
    role: str = Field(..., description="user | assistant | tool")
    content: str
    tool_calls: Optional[list[dict]] = None
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    conversation_id: str = Field(..., description="UUID")
    messages: list[ChatHistoryItem]


# ── Memory ─────────────────────────────────────────────────────────────────


class MemoryResponse(BaseModel):
    id: str = Field(..., description="UUID")
    fact: str
    category: str
    source: str
    created_at: datetime


class MemoryCreateRequest(BaseModel):
    fact: str
    category: str = "general"
    source: str = "manual"


class MemoryUpdateRequest(BaseModel):
    fact: str | None = None
    category: str | None = None


# ── Conversation List ──────────────────────────────────────────────────────


class ConversationListItem(BaseModel):
    conversation_id: str = Field(..., description="UUID")
    title: str | None = None
    summary: str | None = None
    message_count: int
    created_at: datetime


class ConversationListResponse(BaseModel):
    conversations: list[ConversationListItem]
