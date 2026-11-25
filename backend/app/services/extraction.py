from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.document import DocType, Document
from app.schemas.document import DocumentRead
from app.schemas.extraction import ExtractionDetail, ExtractionState, ExtractionStatus, MatchingStatus
from app.services import matching
from app.services.task_results import (
    TaskQueueError,
    forget_tasks,
    load_metas,
    status_from_meta,
    successful_result,
)
from app.worker.tasks import extract_document, match_claims

logger = logging.getLogger(__name__)

ExtractionQueueError = TaskQueueError


def initial_statuses(doc: Document) -> tuple[ExtractionStatus, MatchingStatus | None]:
    extraction = status_from_meta(doc.extraction_task_id, doc.extraction_requested_at, None)
    return extraction, matching.matching_status(doc, extraction, None, {}, None)


def get_statuses(db: Session, docs: list[Document]) -> dict[uuid.UUID, tuple[ExtractionStatus, MatchingStatus | None]]:
    return matching.document_statuses(db, docs)


def get_detail(db: Session, doc: Document) -> ExtractionDetail:
    meta = load_metas(db, [doc.extraction_task_id]).get(doc.extraction_task_id or "")
    status = status_from_meta(doc.extraction_task_id, doc.extraction_requested_at, meta)
    result = successful_result(meta) if status.state is ExtractionState.SUCCEEDED else None
    return ExtractionDetail(**status.model_dump(), result=result)


def to_read(doc: Document, statuses: tuple[ExtractionStatus, MatchingStatus | None]) -> DocumentRead:
    extraction, matching_state = statuses
    return DocumentRead.model_validate(doc).model_copy(update={"extraction": extraction, "matching": matching_state})


def enqueue(db: Session, doc: Document) -> None:
    previous = (doc.extraction_task_id, doc.extraction_requested_at, doc.matching_task_id, doc.matching_requested_at)
    now = datetime.now(timezone.utc)
    task_id = str(uuid.uuid4())
    doc.extraction_task_id = task_id
    doc.extraction_requested_at = now

    link = None
    is_eob = doc.doc_type == DocType.EOB_835.value
    if is_eob:
        match_id = str(uuid.uuid4())
        doc.matching_task_id = match_id
        doc.matching_requested_at = now
        link = match_claims.s(document_id=str(doc.id)).set(task_id=match_id)
    db.commit()

    try:
        extract_document.apply_async(
            args=[str(doc.id)], task_id=task_id, link=link, retry=True, retry_policy={"max_retries": 2}
        )
    except Exception as exc:
        logger.exception("Could not queue extraction for document %s", doc.id)
        (doc.extraction_task_id, doc.extraction_requested_at, doc.matching_task_id, doc.matching_requested_at) = (
            previous
        )
        db.commit()
        raise TaskQueueError("Extraction could not be queued; is the task broker running?") from exc

    forget_tasks([previous[0], previous[2] if is_eob else None])
    if is_eob:
        matching.clear_reviews(db, doc.id)
