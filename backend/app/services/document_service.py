"""
services/document_service.py - Orchestrates the full document ingestion pipeline.

PIPELINE:
  PDF file → validate → extract text → chunk → embed → store in FAISS

This service is the glue between all other services.
It's called by the upload API endpoint.
"""

import uuid
import shutil
from pathlib import Path
from datetime import datetime
from app.config import get_settings
from app.services.pdf_processor import extract_document_text
from app.services.chunker import chunk_pages
from app.services.embedder import get_embedder
from app.database.vector_store import get_vector_store
from app.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024


ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".rst", ".csv"}


def validate_document(file_path: Path, original_filename: str) -> None:
    """
    Validates the uploaded file:
            - Extension must be a supported document type
      - File size must be within limit
            - PDF files must start with PDF magic bytes (%PDF-)
    """
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Only PDF and DOCX files are allowed. Got: {original_filename}")

    file_size = file_path.stat().st_size
    if file_size > MAX_FILE_BYTES:
        raise ValueError(
            f"File too large: {file_size / 1024 / 1024:.1f}MB. "
            f"Max allowed: {settings.MAX_FILE_SIZE_MB}MB"
        )

    if ext == ".pdf":
        with open(file_path, "rb") as f:
            header = f.read(5)
        if header != b"%PDF-":
            raise ValueError("File does not appear to be a valid PDF (invalid header)")


async def ingest_document(tmp_path: Path, original_filename: str) -> dict:
    """
    Full ingestion pipeline for a single PDF.

    Steps:
      1. Validate the file
      2. Save to uploads/ with a UUID filename
      3. Extract text page by page
      4. Chunk the text
      5. Generate embeddings for all chunks
      6. Store embeddings + metadata in FAISS

    Returns a dict with document metadata for the API response.
    """
    # Step 1: Validate
    validate_document(tmp_path, original_filename)

    # Step 2: Assign document ID and save permanently
    document_id = str(uuid.uuid4())
    ext = Path(original_filename).suffix.lower()
    saved_path = UPLOAD_DIR / f"{document_id}{ext}"
    shutil.copy2(tmp_path, saved_path)
    logger.info(f"Saved document: {saved_path} (id={document_id})")

    # Step 3: Extract text
    pages, page_count = extract_document_text(saved_path)
    if not pages:
        raise ValueError("Could not extract any text from the file. The file may be empty or image-only.")

    # Step 4: Chunk
    chunks = chunk_pages(
        pages=pages,
        document_id=document_id,
        filename=original_filename,
    )
    if not chunks:
        raise ValueError("No text chunks could be generated from this PDF.")

    # Attach upload timestamp to each chunk for document listing
    uploaded_at = datetime.utcnow().isoformat()
    for chunk in chunks:
        chunk["uploaded_at"] = uploaded_at

    # Step 5: Embed
    embedder = get_embedder()
    texts = [c["text"] for c in chunks]
    logger.info(f"Generating embeddings for {len(texts)} chunks...")
    embeddings = embedder.embed_texts(texts)

    # Step 6: Store in FAISS
    store = get_vector_store(dimension=embedder.dimension)
    store.add_chunks(chunks, embeddings)

    logger.info(
        f"Ingestion complete: '{original_filename}' → "
        f"{page_count} pages, {len(chunks)} chunks, id={document_id}"
    )

    return {
        "document_id": document_id,
        "filename": original_filename,
        "page_count": page_count,
        "chunk_count": len(chunks),
        "message": f"Successfully processed '{original_filename}'",
    }
