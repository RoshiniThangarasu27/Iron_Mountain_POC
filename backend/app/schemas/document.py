import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.document import DocType
from app.schemas.extraction import ExtractionStatus, MatchingStatus


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doc_type: DocType
    original_filename: str
    stored_filename: str
    storage_path: str
    mime_type: str
    file_size_bytes: int
    sha256_hash: str
    created_at: datetime
    extraction: ExtractionStatus | None = None
    matching: MatchingStatus | None = None


class DocumentList(BaseModel):
    items: list[DocumentRead]
    total: int
    limit: int
    offset: int


class UploadFileError(BaseModel):
    filename: str
    error: str


class UploadFileWarning(BaseModel):
    filename: str
    document_id: uuid.UUID
    message: str
    duplicate_of: list[uuid.UUID] = []


class UploadResponse(BaseModel):
    doc_type: DocType
    documents: list[DocumentRead]
    errors: list[UploadFileError]
    warnings: list[UploadFileWarning]


MAX_BULK_DELETE = 500


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=MAX_BULK_DELETE)
    doc_type: DocType | None = None


class BulkDeleteResponse(BaseModel):
    deleted: list[uuid.UUID]
    not_found: list[uuid.UUID]
    file_cleanup_failed: list[uuid.UUID] = []
