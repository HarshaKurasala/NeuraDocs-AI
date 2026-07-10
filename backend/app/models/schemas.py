"""
models/schemas.py - All Pydantic request/response models.
Pydantic enforces type safety at the API boundary — invalid data is rejected
before it ever reaches business logic. This is the contract between frontend and backend.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    """Returned after a successful PDF upload and indexing."""
    document_id: str = Field(..., description="Unique ID for the uploaded document")
    filename: str
    page_count: int
    chunk_count: int
    message: str


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Incoming chat message from the user."""
    question: str = Field(..., min_length=1, max_length=2000)
    document_ids: list[str] = Field(default_factory=list, description="Scope search to these docs; empty = all")
    session_id: str = Field(default="default", description="Conversation session identifier")
    stream: bool = Field(default=True)


class SourceChunk(BaseModel):
    """A retrieved document chunk returned as a citation."""
    document_id: str
    filename: str
    page_number: int
    chunk_index: int
    content: str
    score: float


class ChatResponse(BaseModel):
    """Non-streaming chat response."""
    answer: str
    sources: list[SourceChunk]
    session_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── History ───────────────────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[HistoryMessage]


# ── Document list ─────────────────────────────────────────────────────────────

class DocumentInfo(BaseModel):
    document_id: str
    filename: str
    page_count: int
    chunk_count: int
    uploaded_at: datetime


class DocumentListResponse(BaseModel):
    documents: list[DocumentInfo]


class SessionInfo(BaseModel):
    session_id: str
    title: str
    message_count: int
    created_at: datetime
    updated_at: datetime


class SessionListResponse(BaseModel):
    sessions: list[SessionInfo]


# ── Error ─────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
