"""
config.py - Centralized configuration using Pydantic BaseSettings.
All environment variables are loaded here and injected via dependency injection.
This ensures a single source of truth for all settings across the app.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import Literal


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "NeuraDocs"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, alias="APP_DEBUG")
    LOG_LEVEL: str = "INFO"

    # ── OpenAI ───────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-3.5-turbo"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # ── Embedding provider: "openai" | "sentence_transformers" ───────────────
    # Default to local embeddings so the app works without an API key.
    EMBEDDING_PROVIDER: Literal["openai", "sentence_transformers"] = "sentence_transformers"
    SENTENCE_TRANSFORMER_MODEL: str = "all-MiniLM-L6-v2"

    # ── Chunking ─────────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150

    # ── Retrieval ────────────────────────────────────────────────────────────
    TOP_K: int = 5
    SCORE_THRESHOLD: float = 0.0   # minimum cosine similarity (0 = no filter)

    # ── Storage paths ────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    VECTORSTORE_DIR: str = "vectorstore"

    # ── File limits ──────────────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 20
    ALLOWED_EXTENSIONS: list[str] = ["pdf", "docx"]

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── Rate limiting ────────────────────────────────────────────────────────
    RATE_LIMIT_REQUESTS: int = 30
    RATE_LIMIT_WINDOW: int = 60   # seconds

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings instance — FastAPI dependency injection uses this.
    lru_cache ensures the .env file is read only once per process.
    """
    return Settings()
