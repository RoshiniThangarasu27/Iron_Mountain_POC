from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from celery import states
from celery.backends.database.models import TaskExtended
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.schemas.extraction import ExtractionState, ExtractionStatus
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

PROGRESS = "PROGRESS"


class TaskQueueError(Exception):
    pass


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


def _error_message(meta: dict[str, Any]) -> str | None:
    result = meta.get("result")
    if isinstance(result, BaseException):
        return str(result) or type(result).__name__
    if meta.get("status") == states.REVOKED:
        return "Task was cancelled"
    return None


def as_utc(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def status_from_meta(
    task_id: str | None, requested_at: datetime | None, meta: dict[str, Any] | None
) -> ExtractionStatus:
    if not task_id:
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
        task_id=task_id,
        state=state,
        celery_state=celery_state,
        step=step,
        error=_error_message(meta) if state in (ExtractionState.FAILED, ExtractionState.RETRYING) else None,
        retries=meta.get("retries"),
        requested_at=requested_at,
        finished_at=as_utc(meta.get("date_done")) if finished else None,
    )


def load_metas(db: Session, task_ids: list[str | None]) -> dict[str, dict[str, Any]]:
    ids = [t for t in task_ids if t]
    if not ids:
        return {}
    rows = db.scalars(select(TaskExtended).where(TaskExtended.task_id.in_(ids)))
    backend = celery_app.backend
    return {row.task_id: backend.meta_from_decoded(row.to_dict()) for row in rows}


def successful_result(meta: dict[str, Any] | None) -> dict[str, Any] | None:
    if meta and meta.get("status") == states.SUCCESS and isinstance(meta.get("result"), dict):
        return meta["result"]
    return None


def forget_tasks(task_ids: list[str | None]) -> None:
    for task_id in filter(None, task_ids):
        try:
            celery_app.backend.forget(task_id)
        except Exception:
            logger.warning("Could not delete stored result for task %s", task_id, exc_info=True)
