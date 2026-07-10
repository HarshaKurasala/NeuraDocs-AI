"""
tests/test_api.py - Backend API tests using pytest + httpx AsyncClient.

Run with: pytest tests/ -v
"""

import pytest
import io
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock, MagicMock
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ── Health check ──────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ── Upload ────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_upload_no_file(client):
    response = await client.post("/api/v1/upload")
    assert response.status_code == 422   # FastAPI validation error


@pytest.mark.anyio
async def test_upload_invalid_extension(client):
    fake_file = io.BytesIO(b"not a pdf")
    response = await client.post(
        "/api/v1/upload",
        files={"files": ("test.txt", fake_file, "text/plain")},
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_upload_valid_pdf(client):
    """Mock the ingestion pipeline to test the upload endpoint in isolation."""
    mock_result = {
        "document_id": "test-uuid-1234",
        "filename": "test.pdf",
        "page_count": 3,
        "chunk_count": 12,
        "message": "Successfully processed 'test.pdf'",
    }
    # Minimal valid PDF bytes
    pdf_bytes = b"%PDF-1.4 fake content"

    with patch("app.api.upload.ingest_document", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = mock_result
        response = await client.post(
            "/api/v1/upload",
            files={"files": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )

    assert response.status_code == 201
    data = response.json()
    assert len(data) == 1
    assert data[0]["document_id"] == "test-uuid-1234"
    assert data[0]["chunk_count"] == 12


# ── Chat ──────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_chat_empty_question(client):
    response = await client.post(
        "/api/v1/chat",
        json={"question": "   ", "stream": False},
    )
    assert response.status_code == 400


@pytest.mark.anyio
async def test_chat_non_streaming(client):
    mock_result = {
        "answer": "The document says X.",
        "sources": [],
        "session_id": "test-session",
    }
    with patch("app.api.chat.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_result
        response = await client.post(
            "/api/v1/chat",
            json={"question": "What is X?", "stream": False, "session_id": "test-session"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "The document says X."
    assert data["session_id"] == "test-session"


# ── History ───────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_get_history_empty(client):
    response = await client.get("/api/v1/history/nonexistent-session")
    assert response.status_code == 200
    assert response.json()["messages"] == []


@pytest.mark.anyio
async def test_delete_history(client):
    response = await client.delete("/api/v1/history/test-session")
    assert response.status_code == 204


# ── Documents ─────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_list_documents(client):
    with patch("app.api.history.get_vector_store") as mock_store_factory:
        mock_store = MagicMock()
        mock_store.list_documents.return_value = []
        mock_store_factory.return_value = mock_store
        response = await client.get("/api/v1/documents")

    assert response.status_code == 200
    assert "documents" in response.json()
