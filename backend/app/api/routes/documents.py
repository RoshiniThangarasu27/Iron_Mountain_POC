import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.document import DocType, Document
from app.schemas.document import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    DocumentList,
    DocumentRead,
    UploadResponse,
)
from app.schemas.extraction import (
    TERMINAL_STATES,
    ExtractionDetail,
    ExtractionStatusItem,
    ExtractionStatusRequest,
)
from app.services import documents as service
from app.services import extraction
from app.services.storage import StorageError, resolve_storage_path

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _get_or_404(db: Session, doc_id: uuid.UUID) -> Document:
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": UploadResponse, "description": "No file in the batch was accepted"}},
)
def upload_documents(
    doc_type: Annotated[DocType, Form(description="edi_837 or eob_835")],
    files: Annotated[list[UploadFile], File(description="One or more files")],
    db: Session = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")
    if len(files) > settings.MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files: {len(files)} (max {settings.MAX_FILES_PER_UPLOAD} per request)",
        )

    result = service.ingest_uploads(db, doc_type, files)
    if not result.documents:
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=result.model_dump(mode="json"))
    return result


@router.get("", response_model=DocumentList)
def list_documents(
    doc_type: Annotated[DocType | None, Query(description="Filter by edi_837 or eob_835")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    db: Session = Depends(get_db),
):
    items, total = service.list_documents(db, doc_type, limit, offset)
    statuses = extraction.get_statuses(db, items)
    return DocumentList(
        items=[extraction.to_read(d, statuses[d.id]) for d in items], total=total, limit=limit, offset=offset
    )


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
def bulk_delete_documents(payload: BulkDeleteRequest, db: Session = Depends(get_db)):
    return service.bulk_delete_documents(db, payload.ids, payload.doc_type)


@router.post("/extraction-status", response_model=list[ExtractionStatusItem])
def extraction_statuses(payload: ExtractionStatusRequest, db: Session = Depends(get_db)):
    docs = list(db.scalars(select(Document).where(Document.id.in_(payload.ids))))
    statuses = extraction.get_statuses(db, docs)
    return [ExtractionStatusItem(document_id=d.id, extraction=statuses[d.id]) for d in docs]


@router.get("/{doc_id}", response_model=DocumentRead)
def get_document(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = _get_or_404(db, doc_id)
    return extraction.to_read(doc, extraction.get_statuses(db, [doc])[doc.id])


@router.get("/{doc_id}/extraction", response_model=ExtractionDetail)
def get_extraction(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    return extraction.get_detail(db, _get_or_404(db, doc_id))


@router.post("/{doc_id}/extract", response_model=ExtractionDetail, status_code=status.HTTP_202_ACCEPTED)
def start_extraction(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = _get_or_404(db, doc_id)
    current = extraction.get_statuses(db, [doc])[doc.id]
    if current.state not in TERMINAL_STATES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Extraction is already in progress")
    try:
        extraction.enqueue(db, doc)
    except extraction.ExtractionQueueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return extraction.get_detail(db, doc)


@router.get("/{doc_id}/content", response_class=FileResponse)
def get_document_content(
    doc_id: uuid.UUID,
    download: Annotated[bool, Query(description="Serve as an attachment instead of inline")] = False,
    db: Session = Depends(get_db),
):
    doc = _get_or_404(db, doc_id)
    try:
        path = resolve_storage_path(doc.storage_path)
    except StorageError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid storage path")
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file is missing")

    media_type = f"{doc.mime_type}; charset=utf-8" if doc.mime_type.startswith("text/") else doc.mime_type
    return FileResponse(
        path,
        media_type=media_type,
        filename=doc.original_filename,
        content_disposition_type="attachment" if download else "inline",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"},
    )


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    doc = _get_or_404(db, doc_id)
    service.delete_document(db, doc)
