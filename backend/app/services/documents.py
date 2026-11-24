from __future__ import annotations

import logging
import uuid

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.document import DocType, Document
from app.schemas.document import BulkDeleteResponse, DocumentRead, UploadFileError, UploadFileWarning, UploadResponse
from app.services import extraction, storage
from app.services.validation import ValidationError, sniff_text, validate_image, validate_request_metadata

logger = logging.getLogger(__name__)


def _detect_mime(doc_type: DocType, stored: storage.StoredFile) -> str:
    if doc_type is DocType.EDI_837:
        return sniff_text(stored.absolute_path)
    return validate_image(stored.absolute_path)


def ingest_uploads(db: Session, doc_type: DocType, files: list[UploadFile]) -> UploadResponse:
    created: list[DocumentRead] = []
    errors: list[UploadFileError] = []
    warnings: list[UploadFileWarning] = []

    for upload in files:
        display_name = (upload.filename or "").replace("\\", "/").rsplit("/", 1)[-1].strip() or "(unnamed)"
        stored: storage.StoredFile | None = None
        try:
            validate_request_metadata(doc_type, upload.filename, upload.content_type)
            stored = storage.save_stream(upload.file, doc_type.value, upload.filename)
            mime = _detect_mime(doc_type, stored)

            duplicates = list(
                db.scalars(
                    select(Document.id).where(
                        Document.sha256_hash == stored.sha256, Document.doc_type == doc_type.value
                    )
                )
            )

            doc = Document(
                id=uuid.uuid4(),
                doc_type=doc_type.value,
                original_filename=display_name[:512],
                stored_filename=stored.stored_filename,
                storage_path=stored.relative_path,
                mime_type=mime,
                file_size_bytes=stored.size_bytes,
                sha256_hash=stored.sha256,
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            try:
                extraction.enqueue(db, doc)
            except extraction.ExtractionQueueError as exc:
                warnings.append(UploadFileWarning(filename=display_name, document_id=doc.id, message=str(exc)))
            created.append(extraction.to_read(doc, extraction.initial_status(doc)))

            if duplicates:
                warnings.append(
                    UploadFileWarning(
                        filename=display_name,
                        document_id=doc.id,
                        message=f"Identical content was already uploaded {len(duplicates)} time(s)",
                        duplicate_of=duplicates,
                    )
                )
        except (ValidationError, storage.StorageError) as exc:
            errors.append(UploadFileError(filename=display_name, error=str(exc)))
            if stored:
                storage.delete_file(stored.relative_path)
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Database error while saving %s", display_name)
            errors.append(UploadFileError(filename=display_name, error="Database error while saving the document"))
            if stored:
                storage.delete_file(stored.relative_path)
        except OSError as exc:
            logger.exception("I/O error while saving %s", display_name)
            errors.append(UploadFileError(filename=display_name, error=f"Could not store file: {exc.strerror or exc}"))
            if stored:
                storage.delete_file(stored.relative_path)
        finally:
            upload.file.close()

    return UploadResponse(doc_type=doc_type, documents=created, errors=errors, warnings=warnings)


def list_documents(db: Session, doc_type: DocType | None, limit: int, offset: int) -> tuple[list[Document], int]:
    stmt = select(Document)
    count_stmt = select(func.count()).select_from(Document)
    if doc_type is not None:
        stmt = stmt.where(Document.doc_type == doc_type.value)
        count_stmt = count_stmt.where(Document.doc_type == doc_type.value)
    stmt = stmt.order_by(Document.created_at.desc(), Document.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt)), db.scalar(count_stmt) or 0


def delete_document(db: Session, doc: Document) -> None:
    relative_path = doc.storage_path
    task_id = doc.extraction_task_id
    db.delete(doc)
    db.commit()
    storage.delete_file(relative_path)
    extraction.forget_tasks([task_id])


def bulk_delete_documents(db: Session, ids: list[uuid.UUID], doc_type: DocType | None = None) -> BulkDeleteResponse:
    unique_ids = list(dict.fromkeys(ids))
    stmt = select(Document).where(Document.id.in_(unique_ids))
    if doc_type is not None:
        stmt = stmt.where(Document.doc_type == doc_type.value)
    docs = list(db.scalars(stmt))

    found = {d.id: d.storage_path for d in docs}
    task_ids = [d.extraction_task_id for d in docs]
    for doc in docs:
        db.delete(doc)
    db.commit()

    cleanup_failed = [doc_id for doc_id, path in found.items() if not storage.delete_file(path)]
    extraction.forget_tasks(task_ids)
    return BulkDeleteResponse(
        deleted=[i for i in unique_ids if i in found],
        not_found=[i for i in unique_ids if i not in found],
        file_cleanup_failed=cleanup_failed,
    )
