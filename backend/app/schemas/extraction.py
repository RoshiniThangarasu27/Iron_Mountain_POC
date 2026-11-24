import enum
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

MAX_STATUS_IDS = 500


class ExtractionState(str, enum.Enum):
    NOT_STARTED = "not_started"
    QUEUED = "queued"
    RUNNING = "running"
    RETRYING = "retrying"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


TERMINAL_STATES = {ExtractionState.NOT_STARTED, ExtractionState.SUCCEEDED, ExtractionState.FAILED}


class ExtractionStatus(BaseModel):
    task_id: str | None = None
    state: ExtractionState
    celery_state: str | None = None
    step: str | None = None
    error: str | None = None
    retries: int | None = None
    requested_at: datetime | None = None
    finished_at: datetime | None = None


class ExtractionDetail(ExtractionStatus):
    result: dict[str, Any] | None = None


class ExtractionStatusRequest(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=MAX_STATUS_IDS)


class ExtractionStatusItem(BaseModel):
    document_id: uuid.UUID
    extraction: ExtractionStatus
