"""
api/history.py - Chat history and document management endpoints.

GET  /history/{session_id}   - Retrieve conversation history
DELETE /history/{session_id} - Clear conversation history
GET  /documents              - List all uploaded documents
DELETE /documents/{doc_id}   - Delete a document and its vectors
"""

from fastapi import APIRouter, HTTPException, status
from app.models.schemas import HistoryResponse, HistoryMessage, DocumentListResponse, DocumentInfo, SessionInfo, SessionListResponse
from app.database.chat_history import load_history, clear_history, list_sessions
from app.database.vector_store import get_vector_store
from app.services.embedder import get_embedder
from app.utils.logger import get_logger
from datetime import datetime

logger = get_logger(__name__)
router = APIRouter()


# ── Sessions endpoint ─────────────────────────────────────────────────────────

@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="List all chat sessions for history panel",
)
async def get_sessions() -> SessionListResponse:
    sessions = list_sessions()
    return SessionListResponse(
        sessions=[
            SessionInfo(
                session_id=s["session_id"],
                title=s["title"],
                message_count=s["message_count"],
                created_at=datetime.fromisoformat(s["created_at"]),
                updated_at=datetime.fromisoformat(s["updated_at"]),
            )
            for s in sessions
        ]
    )


# ── History endpoints ─────────────────────────────────────────────────────────

@router.get(
    "/history/{session_id}",
    response_model=HistoryResponse,
    summary="Get conversation history for a session",
)
async def get_history(session_id: str) -> HistoryResponse:
    messages = load_history(session_id)
    return HistoryResponse(
        session_id=session_id,
        messages=[
            HistoryMessage(
                role=m["role"],
                content=m["content"],
                created_at=datetime.fromisoformat(m.get("created_at", datetime.utcnow().isoformat())),
            )
            for m in messages
        ],
    )


@router.delete(
    "/history/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear conversation history for a session",
)
async def delete_history(session_id: str) -> None:
    clear_history(session_id)


# ── Document endpoints ────────────────────────────────────────────────────────

@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List all uploaded documents",
)
async def list_documents() -> DocumentListResponse:
    embedder = get_embedder()
    store = get_vector_store(dimension=embedder.dimension)
    docs = store.list_documents()
    return DocumentListResponse(
        documents=[
            DocumentInfo(
                document_id=d["document_id"],
                filename=d["filename"],
                page_count=d["page_count"],
                chunk_count=d["chunk_count"],
                uploaded_at=datetime.fromisoformat(d["uploaded_at"]),
            )
            for d in docs
        ]
    )


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document and all its vectors",
)
async def delete_document(document_id: str) -> None:
    embedder = get_embedder()
    store = get_vector_store(dimension=embedder.dimension)
    store.delete_document(document_id)
    logger.info(f"Deleted document: {document_id}")
