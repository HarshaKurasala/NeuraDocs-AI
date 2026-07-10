"""
api/upload.py - PDF upload and ingestion endpoint.

POST /upload
  - Accepts multipart/form-data with one or more PDF files
  - Validates, extracts, chunks, embeds, and stores each file
  - Returns document metadata for each uploaded file

WHY MULTIPART?
Binary files can't be sent as JSON. Multipart/form-data is the HTTP standard
for file uploads — the browser encodes each file as a separate part.
"""

import tempfile
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.models.schemas import UploadResponse
from app.services.document_service import ingest_document
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post(
    "/upload",
    response_model=list[UploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload one or more PDF or Word documents",
    description="Uploads PDF/DOCX files, extracts text, generates embeddings, and stores in FAISS.",
)
async def upload_documents(
    files: list[UploadFile] = File(..., description="One or more PDF or DOCX files"),
) -> list[UploadResponse]:
    """
    Handles multi-file PDF upload.

    Each file is:
      1. Written to a temp file (avoids loading entire file into memory)
      2. Passed through the ingestion pipeline
      3. Temp file is cleaned up regardless of success/failure

    Returns a list of UploadResponse objects, one per file.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided.",
        )

    results: list[UploadResponse] = []

    for upload_file in files:
        # Write to a temp file so we can pass a Path to the processor
        suffix = Path(upload_file.filename).suffix.lower() or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = Path(tmp.name)
            content = await upload_file.read()
            tmp.write(content)

        try:
            logger.info(f"Processing upload: {upload_file.filename}")
            result = await ingest_document(tmp_path, upload_file.filename)
            results.append(UploadResponse(**result))
        except ValueError as e:
            # User-facing validation errors (bad file, too large, etc.)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e),
            )
        except Exception as e:
            logger.error(f"Failed to process {upload_file.filename}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process '{upload_file.filename}': {str(e)}",
            )
        finally:
            # Always clean up the temp file
            if tmp_path.exists():
                tmp_path.unlink()

    return results
