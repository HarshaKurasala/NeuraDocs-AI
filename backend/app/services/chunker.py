"""
services/chunker.py - Text chunking with configurable size and overlap.

WHY CHUNKING?
LLMs have a context window limit. We can't feed an entire PDF into the prompt.
Chunking splits text into overlapping windows so:
  - Each chunk fits in the embedding model's token limit
  - Overlap preserves context across chunk boundaries
  - Semantic search finds the most relevant chunks

STRATEGY: Recursive character splitting
  Split on paragraphs → sentences → words → characters (in that priority order).
  This keeps semantically coherent units together as long as possible.
"""

from langchain.text_splitter import RecursiveCharacterTextSplitter
from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


def chunk_pages(
    pages: list[dict],
    document_id: str,
    filename: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
) -> list[dict]:
    """
    Splits extracted page texts into overlapping chunks.

    Each chunk carries full metadata so we can cite the exact source page later.

    Args:
        pages: list of {page_number, text} dicts from pdf_processor
        document_id: UUID of the parent document
        filename: original PDF filename
        chunk_size: max characters per chunk (defaults to settings)
        chunk_overlap: overlap between consecutive chunks (defaults to settings)

    Returns:
        List of chunk dicts:
        {
            chunk_id, document_id, filename,
            page_number, chunk_index, text, char_count
        }
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        # Priority order: paragraph → sentence → word → character
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    all_chunks: list[dict] = []
    global_chunk_index = 0

    for page in pages:
        page_text = page["text"]
        page_number = page["page_number"]

        if not page_text.strip():
            continue

        # Split this page's text into chunks
        raw_chunks = splitter.split_text(page_text)

        for local_idx, chunk_text in enumerate(raw_chunks):
            chunk_text = chunk_text.strip()
            if not chunk_text:
                continue

            all_chunks.append({
                "chunk_id": f"{document_id}_chunk_{global_chunk_index}",
                "document_id": document_id,
                "filename": filename,
                "page_number": page_number,
                "chunk_index": global_chunk_index,
                "local_chunk_index": local_idx,
                "text": chunk_text,
                "char_count": len(chunk_text),
            })
            global_chunk_index += 1

    logger.info(
        f"Chunked '{filename}' into {len(all_chunks)} chunks "
        f"(size={chunk_size}, overlap={chunk_overlap})"
    )
    return all_chunks
