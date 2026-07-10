"""
services/embedder.py - Embedding generation with pluggable providers.

WHY EMBEDDINGS?
Embeddings convert text into dense numerical vectors that capture semantic meaning.
Similar sentences have vectors that are close together in high-dimensional space.
This enables semantic search: "What is the capital of France?" matches
"Paris is the capital city of France" even without keyword overlap.

PROVIDERS:
  - OpenAI text-embedding-3-small: 1536-dim, best quality, requires API key
  - sentence-transformers all-MiniLM-L6-v2: 384-dim, free, runs locally

The EmbedderBase abstraction lets you swap providers without changing any
other code — just change EMBEDDING_PROVIDER in .env.
"""

from abc import ABC, abstractmethod
import numpy as np
from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


# ── Abstract base ─────────────────────────────────────────────────────────────

class EmbedderBase(ABC):
    @abstractmethod
    def embed_texts(self, texts: list[str]) -> np.ndarray:
        """Embed a list of texts. Returns shape (N, dim) float32 array."""
        ...

    @abstractmethod
    def embed_query(self, text: str) -> np.ndarray:
        """Embed a single query string. Returns shape (dim,) float32 array."""
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Embedding vector dimension."""
        ...


# ── OpenAI provider ───────────────────────────────────────────────────────────

class OpenAIEmbedder(EmbedderBase):
    """
    Uses OpenAI's text-embedding-3-small model.
    Batches requests to stay within API rate limits.
    """

    BATCH_SIZE = 100   # OpenAI allows up to 2048 inputs per request

    def __init__(self):
        from openai import OpenAI
        self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self._model = settings.OPENAI_EMBEDDING_MODEL
        self._dim = 1536 if "3-small" in self._model else 3072
        logger.info(f"OpenAIEmbedder initialized with model={self._model}")

    @property
    def dimension(self) -> int:
        return self._dim

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        all_embeddings = []
        for i in range(0, len(texts), self.BATCH_SIZE):
            batch = texts[i : i + self.BATCH_SIZE]
            response = self._client.embeddings.create(
                model=self._model,
                input=batch,
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)
            logger.debug(f"Embedded batch {i//self.BATCH_SIZE + 1}, size={len(batch)}")

        return np.array(all_embeddings, dtype=np.float32)

    def embed_query(self, text: str) -> np.ndarray:
        response = self._client.embeddings.create(
            model=self._model,
            input=[text],
        )
        return np.array(response.data[0].embedding, dtype=np.float32)


# ── Sentence Transformers provider ────────────────────────────────────────────

class SentenceTransformerEmbedder(EmbedderBase):
    """
    Uses a local sentence-transformers model — no API key required.
    Model is downloaded once and cached in ~/.cache/huggingface/.
    """

    def __init__(self):
        from sentence_transformers import SentenceTransformer
        model_name = settings.SENTENCE_TRANSFORMER_MODEL
        self._model = SentenceTransformer(model_name)
        self._dim = self._model.get_sentence_embedding_dimension()
        logger.info(f"SentenceTransformerEmbedder initialized: {model_name}, dim={self._dim}")

    @property
    def dimension(self) -> int:
        return self._dim

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        embeddings = self._model.encode(
            texts,
            batch_size=64,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,   # cosine similarity via dot product
        )
        return embeddings.astype(np.float32)

    def embed_query(self, text: str) -> np.ndarray:
        embedding = self._model.encode(
            [text],
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return embedding[0].astype(np.float32)


# ── Factory ───────────────────────────────────────────────────────────────────

_embedder_instance: EmbedderBase | None = None


def get_embedder() -> EmbedderBase:
    """
    Singleton factory — creates the embedder once and reuses it.
    Controlled by EMBEDDING_PROVIDER env var.
    """
    global _embedder_instance
    if _embedder_instance is None:
        provider = settings.EMBEDDING_PROVIDER
        if provider == "openai":
            _embedder_instance = OpenAIEmbedder()
        elif provider == "sentence_transformers":
            _embedder_instance = SentenceTransformerEmbedder()
        else:
            raise ValueError(f"Unknown EMBEDDING_PROVIDER: {provider}")
    return _embedder_instance
