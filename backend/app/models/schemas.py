"""Pydantic schemas — matches API_CONTRACT.md."""
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

class OpportunityResponse(BaseModel):
    id: str
    title: str
    company: str
    location: str
    pay: str
    experience_required: str
    age_range: str
    url: str
    category: str

class ChatMessageRequest(BaseModel):
    conversation_id: str | None = None
    message: str

class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    tool_calls: list[dict] | None = None