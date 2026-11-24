import logging
import time
import uuid
from typing import Any

from celery.exceptions import Ignore, SoftTimeLimitExceeded

from app.db.session import SessionLocal
from app.extractors.claim_extractor import extract_claim
from app.extractors.eob_extractor import TRANSIENT_ERRORS, extract_eob
from app.extractors.errors import ExtractionError
from app.models.document import DocType, Document
from app.services.storage import StorageError, resolve_storage_path
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

EXTRACT_TASK_NAME = "documents.extract"


def _is_current(document_id: str, task_id: str) -> bool:
    with SessionLocal() as db:
        doc = db.get(Document, uuid.UUID(document_id))
        return doc is not None and doc.extraction_task_id == task_id


@celery_app.task(
    bind=True,
    name=EXTRACT_TASK_NAME,
    autoretry_for=TRANSIENT_ERRORS,
    retry_backoff=5,
    retry_backoff_max=60,
    retry_jitter=True,
    max_retries=3,
)
def extract_document(self, document_id: str) -> dict[str, Any]:
    started = time.monotonic()

    with SessionLocal() as db:
        doc = db.get(Document, uuid.UUID(document_id))
        if doc is None or doc.extraction_task_id != self.request.id:
            self.backend.forget(self.request.id)
            raise Ignore()
        doc_type = DocType(doc.doc_type)
        storage_path = doc.storage_path
        mime_type = doc.mime_type

    self.update_state(state="PROGRESS", meta={"step": "reading_file"})
    try:
        data = resolve_storage_path(storage_path).read_bytes()
    except (OSError, StorageError) as exc:
        raise ExtractionError("Stored file could not be read") from exc

    try:
        if doc_type is DocType.EDI_837:
            self.update_state(state="PROGRESS", meta={"step": "extracting_claim"})
            extracted = {"claim": extract_claim(data)}
            extractor = "claim_extractor"
        else:
            self.update_state(state="PROGRESS", meta={"step": "calling_model"})
            extracted = extract_eob(data, mime_type)
            extractor = "eob_extractor"
    except SoftTimeLimitExceeded as exc:
        raise ExtractionError("Extraction timed out") from exc

    if not _is_current(document_id, self.request.id):
        self.backend.forget(self.request.id)
        raise Ignore()

    logger.info("Extracted %s document %s", doc_type.value, document_id)
    return {
        "document_id": document_id,
        "doc_type": doc_type.value,
        "extractor": extractor,
        "duration_ms": round((time.monotonic() - started) * 1000),
        **extracted,
    }
