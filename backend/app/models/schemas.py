"""Pydantic request/response schemas — matches API_CONTRACT.md exactly."""

from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str
    message: str

class ErrorResponse(BaseModel):
    error: ErrorDetail


class ProfileResponse(BaseModel):
    user_id: str
    username: str
    name: str
    email: str
    age: int
    country: str
    education_level: str
    employment_status: str
    career_path: str
    interests: list[str]
    created_at: datetime

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    country: Optional[str] = None
    education_level: Optional[str] = None
    employment_status: Optional[str] = None
    interests: Optional[list[str]] = None

class CareerPathUpdate(BaseModel):
    career_path: str


class TaskResponse(BaseModel):
    task_id: str
    title: str
    description: str
    order: int
    status: str

class StepResponse(BaseModel):
    step_id: str
    title: str
    description: str
    order: int
    status: str
    tasks: list[TaskResponse]

class RoadmapResponse(BaseModel):
    roadmap_id: str
    steps: list[StepResponse]


class EvidenceResponse(BaseModel):
    id: str
    file_url: str
    file_type: str
    verification_status: str
    uploaded_at: datetime

class TaskEvidenceResponse(BaseModel):
    task_id: str
    title: str
    evidence: list[EvidenceResponse]

class TaskCompleteResponse(BaseModel):
    task_id: str
    status: str


class ResumeResponse(BaseModel):
    resume_id: str
    content: str | dict

class ResumeUpdate(BaseModel):
    content: str | dict


class OpportunityResponse(BaseModel):
    id: str
    title: str
    company: str
    location: str
    pay: str
    age_requirement: Optional[str] = None
    experience_required: str
    url: str


class ChatMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str

class ChatMessageResponse(BaseModel):
    conversation_id: str
    response: str
    tool_calls: Optional[list[dict]] = None

class ChatHistoryItem(BaseModel):
    role: str
    content: str
    tool_calls: Optional[list[dict]] = None
    created_at: datetime

class ChatHistoryResponse(BaseModel):
    conversation_id: str
    messages: list[ChatHistoryItem]