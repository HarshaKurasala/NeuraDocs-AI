"""
api/chat.py - Chat endpoint with streaming and non-streaming support.

POST /chat
  - Accepts a question, optional document filter, and session ID
  - Returns a streaming SSE response (default) or a JSON response
  - Sources (citations) are included in both modes

WHY SERVER-SENT EVENTS (SSE)?
SSE is a one-way HTTP streaming protocol — perfect for LLM token streaming.
Unlike WebSockets, SSE works over standard HTTP/1.1, is firewall-friendly,
and automatically reconnects. The frontend uses EventSource or fetch+ReadableStream.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from app.models.schemas import ChatRequest, ChatResponse, SourceChunk
from app.services.rag_chain import chat, chat_stream
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post(
    "/chat",
    summary="Ask a question about uploaded documents",
    description="Returns a streaming SSE response by default, or JSON if stream=false.",
)
async def chat_endpoint(request: ChatRequest):
    """
    Main chat endpoint.

    If request.stream=True (default):
      Returns StreamingResponse with Content-Type: text/event-stream
      Frontend reads tokens as they arrive.

    If request.stream=False:
      Returns a standard JSON ChatResponse after the full answer is generated.
    """
    if not request.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    doc_ids = request.document_ids if request.document_ids else None

    # ── Streaming mode ────────────────────────────────────────────────────────
    if request.stream:
        async def event_generator():
            try:
                async for chunk in chat_stream(
                    question=request.question,
                    session_id=request.session_id,
                    document_ids=doc_ids,
                ):
                    yield chunk
            except Exception as e:
                logger.error(f"Streaming error: {e}", exc_info=True)
                yield f"data: [ERROR]{str(e)}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",   # disable nginx buffering
                "Connection": "keep-alive",
            },
        )

    # ── Non-streaming mode ────────────────────────────────────────────────────
    try:
        result = await chat(
            question=request.question,
            session_id=request.session_id,
            document_ids=doc_ids,
        )
        return ChatResponse(
            answer=result["answer"],
            sources=[SourceChunk(**s) for s in result["sources"]],
            session_id=result["session_id"],
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {str(e)}",
        )
