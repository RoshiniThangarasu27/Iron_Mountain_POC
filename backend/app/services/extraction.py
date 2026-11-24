from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from celery import states
from celery.backends.database.models import TaskExtended
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.schemas.document import DocumentRead
from app.schemas.extraction import ExtractionDetail, ExtractionState, ExtractionStatus
from app.worker.celery_app import celery_app
from app.worker.tasks import extract_document

logger = logging.getLogger(__name__)

PROGRESS = "PROGRESS"

CELERY_TO_STATE = {
    states.PENDING: ExtractionState.QUEUED,
    states.RECEIVED: ExtractionState.QUEUED,
    states.STARTED: ExtractionState.RUNNING,
    PROGRESS: ExtractionState.RUNNING,
    states.RETRY: ExtractionState.RETRYING,
    states.SUCCESS: ExtractionState.SUCCEEDED,
    states.FAILURE: ExtractionState.FAILED,
    states.REVOKED: ExtractionState.FAILED,
}


class ExtractionQueueError(Exception):
    pass


def _error_message(meta: dict[str, Any]) -> str | None:
    result = meta.get("result")
    if isinstance(result, BaseException):
        return str(result) or type(result).__name__
    if meta.get("status") == states.REVOKED:
        return "Extraction was cancelled"
    return None


def _as_utc(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _status_from_meta(doc: Document, meta: dict[str, Any] | None) -> ExtractionStatus:
    if not doc.extraction_task_id:
        return ExtractionStatus(state=ExtractionState.NOT_STARTED)

    meta = meta or {}
    celery_state = meta.get("status", states.PENDING)
    result = meta.get("result")
    state = CELERY_TO_STATE.get(celery_state, ExtractionState.RUNNING)

    step = None
    if celery_state == states.STARTED:
        step = "starting"
    elif celery_state == PROGRESS and isinstance(result, dict):
        step = result.get("step")

    finished = state in (ExtractionState.SUCCEEDED, ExtractionState.FAILED)
    return ExtractionStatus(
        task_id=doc.extraction_task_id,
        state=state,
        celery_state=celery_state,
        step=step,
        error=_error_message(meta) if state in (ExtractionState.FAILED, ExtractionState.RETRYING) else None,
        retries=meta.get("retries"),
        requested_at=doc.extraction_requested_at,
        finished_at=_as_utc(meta.get("date_done")) if finished else None,
    )


def _load_metas(db: Session, task_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not task_ids:
        return {}
    rows = db.scalars(select(TaskExtended).where(TaskExtended.task_id.in_(task_ids)))
    backend = celery_app.backend
    return {row.task_id: backend.meta_from_decoded(row.to_dict()) for row in rows}


def initial_status(doc: Document) -> ExtractionStatus:
    return _status_from_meta(doc, None)


def get_statuses(db: Session, docs: list[Document]) -> dict[uuid.UUID, ExtractionStatus]:
    metas = _load_metas(db, [d.extraction_task_id for d in docs if d.extraction_task_id])
    return {d.id: _status_from_meta(d, metas.get(d.extraction_task_id or "")) for d in docs}


def get_detail(db: Session, doc: Document) -> ExtractionDetail:
    meta = _load_metas(db, [doc.extraction_task_id]).get(doc.extraction_task_id) if doc.extraction_task_id else None
    status = _status_from_meta(doc, meta)
    result = meta.get("result") if meta and status.state is ExtractionState.SUCCEEDED else None
    return ExtractionDetail(**status.model_dump(), result=result if isinstance(result, dict) else None)


def to_read(doc: Document, status: ExtractionStatus | None) -> DocumentRead:
    return DocumentRead.model_validate(doc).model_copy(update={"extraction": status})


def forget_tasks(task_ids: list[str | None]) -> None:
    for task_id in filter(None, task_ids):
        try:
            celery_app.backend.forget(task_id)
        except Exception:
            logger.warning("Could not delete stored result for task %s", task_id, exc_info=True)


def enqueue(db: Session, doc: Document) -> None:
    previous = doc.extraction_task_id
    previous_requested_at = doc.extraction_requested_at
    task_id = str(uuid.uuid4())
    doc.extraction_task_id = task_id
    doc.extraction_requested_at = datetime.now(timezone.utc)
    db.commit()

    try:
        extract_document.apply_async(args=[str(doc.id)], task_id=task_id, retry=True, retry_policy={"max_retries": 2})
    except Exception as exc:
        logger.exception("Could not queue extraction for document %s", doc.id)
        doc.extraction_task_id = previous
        doc.extraction_requested_at = previous_requested_at
        db.commit()
        raise ExtractionQueueError("Extraction could not be queued; is the task broker running?") from exc

    if previous:
        forget_tasks([previous])
