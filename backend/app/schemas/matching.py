import enum
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.document import ReviewDecision
from app.schemas.extraction import MatchingStatus


class EffectiveMatchStatus(str, enum.Enum):
    AUTO_MATCHED = "auto_matched"
    NEEDS_REVIEW = "needs_review"
    UNMATCHED = "unmatched"
    CONFIRMED = "confirmed"
    NO_MATCH = "no_match"


class ClaimReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    claim_index: int
    decision: ReviewDecision
    edi_document_id: uuid.UUID | None
    edi_claim_id: str | None
    note: str | None
    created_at: datetime
    updated_at: datetime


class ClaimReviewRequest(BaseModel):
    decision: ReviewDecision
    edi_document_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def accepted_needs_claim(self) -> "ClaimReviewRequest":
        if self.decision is ReviewDecision.ACCEPTED and self.edi_document_id is None:
            raise ValueError("edi_document_id is required when accepting a match")
        if self.decision is ReviewDecision.NO_MATCH:
            self.edi_document_id = None
        return self


class ClaimMatchItem(BaseModel):
    index: int
    input: dict[str, Any]
    best_match: dict[str, Any] | None
    candidates: list[dict[str, Any]]
    hitl: dict[str, Any]
    effective_status: EffectiveMatchStatus
    review: ClaimReviewRead | None = None


class MatchingDetail(MatchingStatus):
    matched_at: datetime | None = None
    repository_size: int | None = None
    forced: bool = False
    claims: list[ClaimMatchItem] = []


class StartMatchingRequest(BaseModel):
    force: bool = False


class LinkedClaim(BaseModel):
    document_id: uuid.UUID | None
    filename: str | None
    claim_id: str | None
    score: float | None = None


class ReconciliationRow(BaseModel):
    eob_document_id: uuid.UUID
    eob_filename: str
    claim_index: int
    eob_claim: dict[str, Any]
    status: EffectiveMatchStatus
    match_score: float | None
    reasons: list[str]
    linked: LinkedClaim | None
    suggested: LinkedClaim | None
    review: ClaimReviewRead | None
    matched_at: datetime | None
    stale: bool


class ReconciliationDocuments(BaseModel):
    total: int = 0
    matched: int = 0
    in_progress: int = 0
    skipped: int = 0
    failed: int = 0
    not_started: int = 0


class ReconciliationResponse(BaseModel):
    summary: dict[EffectiveMatchStatus, int]
    documents: ReconciliationDocuments
    rows: list[ReconciliationRow]


class RerunMatchingResponse(BaseModel):
    queued: int
    skipped: int
