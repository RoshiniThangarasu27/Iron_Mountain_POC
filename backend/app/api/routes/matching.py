import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.document import DocType, Document
from app.schemas.extraction import ACTIVE_STATES, ExtractionState
from app.schemas.matching import (
    ClaimReviewRead,
    ClaimReviewRequest,
    EffectiveMatchStatus,
    MatchingDetail,
    ReconciliationResponse,
    RerunMatchingResponse,
    StartMatchingRequest,
)
from app.services import matching
from app.services.task_results import TaskQueueError

router = APIRouter(prefix="/api", tags=["matching"])


def _get_eob_or_404(db: Session, doc_id: uuid.UUID) -> Document:
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.doc_type != DocType.EOB_835.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Claim matching is only available for EOB / 835 documents"
        )
    return doc


@router.get("/documents/{doc_id}/matches", response_model=MatchingDetail)
def get_matches(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    return matching.get_matching_detail(db, _get_eob_or_404(db, doc_id))


@router.post("/documents/{doc_id}/match", response_model=MatchingDetail, status_code=status.HTTP_202_ACCEPTED)
def start_matching(doc_id: uuid.UUID, payload: StartMatchingRequest | None = None, db: Session = Depends(get_db)):
    doc = _get_eob_or_404(db, doc_id)
    extraction, current = matching.document_statuses(db, [doc])[doc.id]
    if extraction.state is not ExtractionState.SUCCEEDED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The EOB must be extracted before matching")
    if current is not None and current.state in ACTIVE_STATES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Matching is already in progress")
    try:
        matching.enqueue_matching(db, doc, force=bool(payload and payload.force))
    except TaskQueueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return matching.get_matching_detail(db, doc)


@router.put("/documents/{doc_id}/matches/{claim_index}/review", response_model=ClaimReviewRead)
def review_match(
    doc_id: uuid.UUID, claim_index: int, payload: ClaimReviewRequest, db: Session = Depends(get_db)
) -> ClaimReviewRead:
    doc = _get_eob_or_404(db, doc_id)
    try:
        return matching.save_review(db, doc, claim_index, payload)
    except matching.MatchingNotAvailable as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.delete("/documents/{doc_id}/matches/{claim_index}/review", status_code=status.HTTP_204_NO_CONTENT)
def undo_review(doc_id: uuid.UUID, claim_index: int, db: Session = Depends(get_db)) -> None:
    if not matching.delete_review(db, _get_eob_or_404(db, doc_id), claim_index):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No review to undo")


@router.get("/reconciliation", response_model=ReconciliationResponse)
def get_reconciliation(
    status_filter: Annotated[EffectiveMatchStatus | None, Query(alias="status")] = None,
    edi_document_id: Annotated[uuid.UUID | None, Query()] = None,
    db: Session = Depends(get_db),
):
    return matching.reconciliation(db, status_filter, edi_document_id)


@router.post("/reconciliation/rerun", response_model=RerunMatchingResponse)
def rerun_matching(db: Session = Depends(get_db)):
    try:
        return matching.rerun_all(db)
    except TaskQueueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
