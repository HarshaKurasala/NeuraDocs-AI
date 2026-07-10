"""
main.py - FastAPI application entry point.

This file:
  1. Creates the FastAPI app instance
  2. Configures CORS (Cross-Origin Resource Sharing) for the React frontend
  3. Registers all API routers
  4. Adds global exception handlers
  5. Adds rate limiting middleware
  6. Serves the app via Uvicorn
"""

import time
from collections import defaultdict
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.config import get_settings
from app.api import upload, chat, history
from app.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

# ── Rate limiter (simple in-memory token bucket) ──────────────────────────────
# For production, use slowapi + Redis instead
_request_counts: dict[str, list[float]] = defaultdict(list)


def is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    window_start = now - settings.RATE_LIMIT_WINDOW
    # Keep only requests within the current window
    _request_counts[client_ip] = [
        t for t in _request_counts[client_ip] if t > window_start
    ]
    if len(_request_counts[client_ip]) >= settings.RATE_LIMIT_REQUESTS:
        return True
    _request_counts[client_ip].append(now)
    return False


# ── Lifespan: startup/shutdown events ────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on startup: pre-load the embedder so the first request isn't slow.
    Runs on shutdown: cleanup if needed.
    """
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    try:
        from app.services.embedder import get_embedder
        get_embedder()   # warm up the embedding model
        logger.info("Embedding model loaded successfully")
    except Exception as e:
        logger.warning(f"Could not pre-load embedder: {e}")
    yield
    logger.info("Application shutting down")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-grade RAG Chatbot API — upload PDFs and ask questions.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allows the React frontend (localhost:5173) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Rate limiting middleware ──────────────────────────────────────────────────

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    if is_rate_limited(client_ip):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too many requests. Please slow down."},
        )
    return await call_next(request)


# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(upload.router, prefix="/api/v1", tags=["Upload"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])
app.include_router(history.router, prefix="/api/v1", tags=["History & Documents"])


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}


# ── Dev server entry point ────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
