"""
database/vector_store.py - FAISS vector store with metadata persistence.

WHY FAISS?
FAISS (Facebook AI Similarity Search) is a library for efficient similarity
search over dense vectors. It uses an inverted index + quantization to search
millions of vectors in milliseconds.

ARCHITECTURE:
  - FAISS index: stores raw float32 vectors, supports L2 / inner-product search
  - metadata.json: maps FAISS integer IDs → chunk metadata (text, page, filename)
  - index.faiss: the serialized FAISS index file

ABSTRACTION:
  VectorStoreBase defines the interface. FAISSVectorStore implements it.
  Swapping to Pinecone/Qdrant/Weaviate only requires a new implementation class.
"""

import json
import faiss
import numpy as np
from pathlib import Path
from abc import ABC, abstractmethod
from datetime import datetime
from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


# ── Abstract interface ────────────────────────────────────────────────────────

class VectorStoreBase(ABC):
    @abstractmethod
    def add_chunks(self, chunks: list[dict], embeddings: np.ndarray) -> None: ...

    @abstractmethod
    def search(self, query_vector: np.ndarray, top_k: int, document_ids: list[str] | None) -> list[dict]: ...

    @abstractmethod
    def delete_document(self, document_id: str) -> None: ...

    @abstractmethod
    def list_documents(self) -> list[dict]: ...


# ── FAISS implementation ──────────────────────────────────────────────────────

class FAISSVectorStore(VectorStoreBase):
    """
    Persistent FAISS vector store.

    Files written to VECTORSTORE_DIR:
      index.faiss   — the FAISS index (binary)
      metadata.json — list of chunk metadata dicts, index position = FAISS ID
    """

    def __init__(self, dimension: int):
        self._dim = dimension
        self._store_dir = Path(settings.VECTORSTORE_DIR)
        self._store_dir.mkdir(parents=True, exist_ok=True)

        self._index_path = self._store_dir / "index.faiss"
        self._meta_path = self._store_dir / "metadata.json"

        self._index: faiss.IndexFlatIP | None = None   # Inner Product = cosine on normalized vecs
        self._metadata: list[dict] = []                # parallel list to FAISS IDs

        self._load()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self) -> None:
        """Load existing index and metadata from disk, or create fresh ones."""
        if self._index_path.exists() and self._meta_path.exists():
            self._index = faiss.read_index(str(self._index_path))
            with open(self._meta_path, "r", encoding="utf-8") as f:
                self._metadata = json.load(f)
            logger.info(f"Loaded FAISS index: {self._index.ntotal} vectors, {len(self._metadata)} metadata entries")
        else:
            # IndexFlatIP: exact inner-product search (cosine similarity when vectors are L2-normalized)
            self._index = faiss.IndexFlatIP(self._dim)
            self._metadata = []
            logger.info(f"Created new FAISS index (dim={self._dim})")

    def _save(self) -> None:
        """Persist index and metadata to disk."""
        faiss.write_index(self._index, str(self._index_path))
        with open(self._meta_path, "w", encoding="utf-8") as f:
            json.dump(self._metadata, f, ensure_ascii=False, default=str)
        logger.debug(f"Saved FAISS index: {self._index.ntotal} vectors")

    # ── Core operations ───────────────────────────────────────────────────────

    def add_chunks(self, chunks: list[dict], embeddings: np.ndarray) -> None:
        """
        Add chunk embeddings to the FAISS index.
        embeddings shape: (N, dim), must be L2-normalized for cosine similarity.
        """
        if len(chunks) != len(embeddings):
            raise ValueError("chunks and embeddings must have the same length")

        # L2-normalize so inner product == cosine similarity
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)   # avoid division by zero
        normalized = (embeddings / norms).astype(np.float32)

        self._index.add(normalized)
        self._metadata.extend(chunks)
        self._save()
        logger.info(f"Added {len(chunks)} chunks to FAISS index (total={self._index.ntotal})")

    def search(
        self,
        query_vector: np.ndarray,
        top_k: int = 5,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        """
        Semantic search: returns top_k most similar chunks.

        Args:
            query_vector: L2-normalized query embedding, shape (dim,)
            top_k: number of results to return
            document_ids: if provided, filter results to these documents only

        Returns:
            List of chunk dicts with added 'score' field (cosine similarity 0-1)
        """
        if self._index.ntotal == 0:
            return []

        # Normalize query vector
        norm = np.linalg.norm(query_vector)
        if norm > 0:
            query_vector = query_vector / norm
        query_vector = query_vector.reshape(1, -1).astype(np.float32)

        # Fetch more results if we need to filter by document_id
        fetch_k = top_k * 10 if document_ids else top_k
        fetch_k = min(fetch_k, self._index.ntotal)

        scores, indices = self._index.search(query_vector, fetch_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:   # FAISS returns -1 for empty slots
                continue
            if score < settings.SCORE_THRESHOLD:
                continue

            chunk = dict(self._metadata[idx])
            chunk["score"] = float(score)

            # Apply document filter
            if document_ids and chunk["document_id"] not in document_ids:
                continue

            results.append(chunk)
            if len(results) >= top_k:
                break

        logger.debug(f"Search returned {len(results)} results")
        return results

    def delete_document(self, document_id: str) -> None:
        """
        Remove all chunks belonging to a document.
        FAISS FlatIP doesn't support in-place deletion, so we rebuild the index.
        """
        keep_indices = [
            i for i, m in enumerate(self._metadata)
            if m["document_id"] != document_id
        ]

        if len(keep_indices) == len(self._metadata):
            logger.warning(f"No chunks found for document_id={document_id}")
            return

        # Reconstruct index from kept vectors
        kept_vectors = np.array([
            self._index.reconstruct(i) for i in keep_indices
        ], dtype=np.float32)

        new_index = faiss.IndexFlatIP(self._dim)
        if len(kept_vectors) > 0:
            new_index.add(kept_vectors)

        self._index = new_index
        self._metadata = [self._metadata[i] for i in keep_indices]
        self._save()
        logger.info(f"Deleted document {document_id}, {len(self._metadata)} chunks remaining")

    def list_documents(self) -> list[dict]:
        """Return unique documents with their chunk counts."""
        docs: dict[str, dict] = {}
        for chunk in self._metadata:
            doc_id = chunk["document_id"]
            if doc_id not in docs:
                docs[doc_id] = {
                    "document_id": doc_id,
                    "filename": chunk["filename"],
                    "chunk_count": 0,
                    "page_count": 0,
                    "uploaded_at": chunk.get("uploaded_at", datetime.utcnow().isoformat()),
                }
            docs[doc_id]["chunk_count"] += 1
            docs[doc_id]["page_count"] = max(
                docs[doc_id]["page_count"], chunk.get("page_number", 0)
            )
        return list(docs.values())


# ── Singleton ─────────────────────────────────────────────────────────────────

_store_instance: FAISSVectorStore | None = None


def get_vector_store(dimension: int = 1536) -> FAISSVectorStore:
    """
    Returns the singleton FAISSVectorStore.
    Dimension is set on first call and must match the embedding model.
    """
    global _store_instance
    if _store_instance is None:
        _store_instance = FAISSVectorStore(dimension=dimension)
    return _store_instance
