from __future__ import annotations

import logging
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.matching.constants import NO_MATCH
from app.matching.repository import load_claim_repository
from app.models.document import ClaimMatchReview, DocType, Document, ReviewDecision
from app.schemas.extraction import (
    ACTIVE_STATES,
    ExtractionState,
    ExtractionStatus,
    MatchingStatus,
    MatchingSummary,
)
from app.schemas.matching import (
    ClaimMatchItem,
    ClaimReviewRead,
    ClaimReviewRequest,
    EffectiveMatchStatus,
    LinkedClaim,
    MatchingDetail,
    ReconciliationDocuments,
    ReconciliationResponse,
    ReconciliationRow,
    RerunMatchingResponse,
)
from app.services.task_results import TaskQueueError, forget_tasks, load_metas, status_from_meta, successful_result
from app.worker.tasks import match_claims

logger = logging.getLogger(__name__)


class MatchingNotAvailable(Exception):
    pass


ReviewMap = dict[tuple[uuid.UUID, int], ClaimMatchReview]


def effective_status(claim: dict[str, Any], review: ClaimMatchReview | None) -> EffectiveMatchStatus:
    if review is not None:
        if review.decision == ReviewDecision.ACCEPTED.value:
            return EffectiveMatchStatus.CONFIRMED
        return EffectiveMatchStatus.NO_MATCH
    best = claim.get("best_match")
    if not best or best.get("status") == NO_MATCH:
        return EffectiveMatchStatus.UNMATCHED
    if not (claim.get("hitl") or {}).get("requires_human_review"):
        return EffectiveMatchStatus.AUTO_MATCHED
    return EffectiveMatchStatus.NEEDS_REVIEW


def load_reviews(db: Session, eob_document_ids: list[uuid.UUID]) -> ReviewMap:
    if not eob_document_ids:
        return {}
    rows = db.scalars(select(ClaimMatchReview).where(ClaimMatchReview.eob_document_id.in_(eob_document_ids)))
    return {(r.eob_document_id, r.claim_index): r for r in rows}


def current_repository_ids(db: Session) -> set[str]:
    return {claim["document_id"] for claim in load_claim_repository(db)}


def is_stale(result: dict[str, Any], repository_ids: set[str]) -> bool:
    return set(result.get("repository_document_ids") or []) != repository_ids


def summarize(
    doc_id: uuid.UUID, result: dict[str, Any], reviews: ReviewMap, repository_ids: set[str]
) -> MatchingSummary:
    counts = Counter(
        effective_status(claim, reviews.get((doc_id, claim["index"]))).value for claim in result.get("claims") or []
    )
    return MatchingSummary(
        claims=sum(counts.values()),
        skipped=bool(result.get("skipped")),
        skip_reason=result.get("skip_reason"),
        stale=is_stale(result, repository_ids),
        **counts,
    )


def matching_status(
    doc: Document,
    extraction_status: ExtractionStatus,
    meta: dict[str, Any] | None,
    reviews: ReviewMap,
    repository_ids: set[str] | None,
) -> MatchingStatus | None:
    if doc.doc_type != DocType.EOB_835.value:
        return None
    if not doc.matching_task_id:
        return MatchingStatus(state=ExtractionState.NOT_STARTED)
    if extraction_status.state in ACTIVE_STATES:
        return MatchingStatus(
            task_id=doc.matching_task_id,
            state=ExtractionState.QUEUED,
            step="waiting_for_extraction",
            requested_at=doc.matching_requested_at,
        )
    if extraction_status.state is not ExtractionState.SUCCEEDED and meta is None:
        return MatchingStatus(state=ExtractionState.NOT_STARTED)

    base = status_from_meta(doc.matching_task_id, doc.matching_requested_at, meta)
    result = successful_result(meta)
    summary = summarize(doc.id, result, reviews, repository_ids or set()) if result is not None else None
    return MatchingStatus(**base.model_dump(), summary=summary)


def document_statuses(
    db: Session, docs: list[Document]
) -> dict[uuid.UUID, tuple[ExtractionStatus, MatchingStatus | None]]:
    metas = load_metas(db, [d.extraction_task_id for d in docs] + [d.matching_task_id for d in docs])
    eob_ids = [d.id for d in docs if d.doc_type == DocType.EOB_835.value]
    reviews = load_reviews(db, eob_ids)
    needs_repository = any(successful_result(metas.get(d.matching_task_id or "")) is not None for d in docs)
    repository_ids = current_repository_ids(db) if needs_repository else None

    statuses = {}
    for doc in docs:
        extraction = status_from_meta(
            doc.extraction_task_id, doc.extraction_requested_at, metas.get(doc.extraction_task_id or "")
        )
        matching = matching_status(doc, extraction, metas.get(doc.matching_task_id or ""), reviews, repository_ids)
        statuses[doc.id] = (extraction, matching)
    return statuses


def enqueue_matching(db: Session, doc: Document, force: bool = False) -> None:
    previous_id, previous_at = doc.matching_task_id, doc.matching_requested_at
    task_id = str(uuid.uuid4())
    doc.matching_task_id = task_id
    doc.matching_requested_at = datetime.now(timezone.utc)
    db.commit()
    try:
        match_claims.apply_async(
            args=[None],
            kwargs={"document_id": str(doc.id), "force": force},
            task_id=task_id,
            retry=True,
            retry_policy={"max_retries": 2},
        )
    except Exception as exc:
        logger.exception("Could not queue matching for document %s", doc.id)
        doc.matching_task_id, doc.matching_requested_at = previous_id, previous_at
        db.commit()
        raise TaskQueueError("Matching could not be queued; is the task broker running?") from exc
    forget_tasks([previous_id])


def clear_reviews(db: Session, eob_document_id: uuid.UUID) -> None:
    db.execute(delete(ClaimMatchReview).where(ClaimMatchReview.eob_document_id == eob_document_id))
    db.commit()


def _claim_items(doc_id: uuid.UUID, result: dict[str, Any], reviews: ReviewMap) -> list[ClaimMatchItem]:
    items = []
    for claim in result.get("claims") or []:
        review = reviews.get((doc_id, claim["index"]))
        items.append(
            ClaimMatchItem(
                index=claim["index"],
                input=claim.get("input") or {},
                best_match=claim.get("best_match"),
                candidates=claim.get("candidates") or [],
                hitl=claim.get("hitl") or {},
                effective_status=effective_status(claim, review),
                review=ClaimReviewRead.model_validate(review) if review else None,
            )
        )
    return items


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def get_matching_detail(db: Session, doc: Document) -> MatchingDetail:
    if doc.doc_type != DocType.EOB_835.value:
        raise MatchingNotAvailable("Claim matching is only available for EOB / 835 documents")
    _, status = document_statuses(db, [doc])[doc.id]
    meta = load_metas(db, [doc.matching_task_id]).get(doc.matching_task_id or "")
    result = successful_result(meta) or {}
    reviews = load_reviews(db, [doc.id])
    return MatchingDetail(
        **(status or MatchingStatus(state=ExtractionState.NOT_STARTED)).model_dump(),
        matched_at=_parse_datetime(result.get("matched_at")),
        repository_size=result.get("repository_size"),
        forced=bool(result.get("forced")),
        claims=_claim_items(doc.id, result, reviews) if result else [],
    )


def _current_result(db: Session, doc: Document) -> dict[str, Any]:
    meta = load_metas(db, [doc.matching_task_id]).get(doc.matching_task_id or "")
    result = successful_result(meta)
    if result is None or result.get("skipped"):
        raise MatchingNotAvailable("This EOB has no completed matching result to review")
    return result


def save_review(db: Session, doc: Document, claim_index: int, request: ClaimReviewRequest) -> ClaimReviewRead:
    result = _current_result(db, doc)
    claim = next((c for c in result.get("claims") or [] if c["index"] == claim_index), None)
    if claim is None:
        raise MatchingNotAvailable(f"EOB claim #{claim_index} was not found in the matching result")

    edi_claim_id = None
    if request.decision is ReviewDecision.ACCEPTED:
        edi_doc = db.get(Document, request.edi_document_id)
        if edi_doc is None or edi_doc.doc_type != DocType.EDI_837.value:
            raise MatchingNotAvailable("The selected 837 document does not exist")
        edi_claim = next(
            (c for c in load_claim_repository(db) if c["document_id"] == str(edi_doc.id)),
            None,
        )
        if edi_claim is None:
            raise MatchingNotAvailable("The selected 837 document has no extracted claim")
        edi_claim_id = edi_claim.get("claim_id")

    review = db.scalar(
        select(ClaimMatchReview).where(
            ClaimMatchReview.eob_document_id == doc.id, ClaimMatchReview.claim_index == claim_index
        )
    )
    if review is None:
        review = ClaimMatchReview(id=uuid.uuid4(), eob_document_id=doc.id, claim_index=claim_index)
        db.add(review)
    review.decision = request.decision.value
    review.edi_document_id = request.edi_document_id
    review.edi_claim_id = edi_claim_id
    review.note = request.note
    db.commit()
    db.refresh(review)
    return ClaimReviewRead.model_validate(review)


def delete_review(db: Session, doc: Document, claim_index: int) -> bool:
    result = db.execute(
        delete(ClaimMatchReview).where(
            ClaimMatchReview.eob_document_id == doc.id, ClaimMatchReview.claim_index == claim_index
        )
    )
    db.commit()
    return bool(result.rowcount)


def _linked(candidate: dict[str, Any] | None) -> LinkedClaim | None:
    if not candidate:
        return None
    return LinkedClaim(
        document_id=candidate.get("document_id"),
        filename=candidate.get("filename"),
        claim_id=candidate.get("claim_id"),
        score=candidate.get("score"),
    )


def reconciliation(
    db: Session,
    status_filter: EffectiveMatchStatus | None = None,
    edi_document_id: uuid.UUID | None = None,
) -> ReconciliationResponse:
    eob_docs = list(
        db.scalars(
            select(Document).where(Document.doc_type == DocType.EOB_835.value).order_by(Document.created_at.desc())
        )
    )
    statuses = document_statuses(db, eob_docs)
    metas = load_metas(db, [d.matching_task_id for d in eob_docs])
    reviews = load_reviews(db, [d.id for d in eob_docs])
    edi_names = {
        row.id: row.original_filename
        for row in db.execute(
            select(Document.id, Document.original_filename).where(Document.doc_type == DocType.EDI_837.value)
        )
    }

    documents = ReconciliationDocuments(total=len(eob_docs))
    rows: list[ReconciliationRow] = []
    for doc in eob_docs:
        extraction, matching = statuses[doc.id]
        if matching is None or matching.state is ExtractionState.NOT_STARTED:
            documents.not_started += 1
            continue
        if matching.state in ACTIVE_STATES:
            documents.in_progress += 1
            continue
        if matching.state is ExtractionState.FAILED:
            documents.failed += 1
            continue
        result = successful_result(metas.get(doc.matching_task_id or "")) or {}
        if result.get("skipped"):
            documents.skipped += 1
            continue
        documents.matched += 1

        matched_at = _parse_datetime(result.get("matched_at"))
        stale = bool(matching.summary and matching.summary.stale)
        for claim in result.get("claims") or []:
            review = reviews.get((doc.id, claim["index"]))
            status = effective_status(claim, review)
            best = claim.get("best_match")
            linked = suggested = None
            if status is EffectiveMatchStatus.CONFIRMED and review is not None:
                linked = LinkedClaim(
                    document_id=review.edi_document_id,
                    filename=edi_names.get(review.edi_document_id) if review.edi_document_id else None,
                    claim_id=review.edi_claim_id,
                    score=next(
                        (
                            c.get("score")
                            for c in claim.get("candidates") or []
                            if c.get("document_id") == str(review.edi_document_id)
                        ),
                        None,
                    ),
                )
            elif status is EffectiveMatchStatus.AUTO_MATCHED:
                linked = _linked(best)
            elif status in (EffectiveMatchStatus.NEEDS_REVIEW, EffectiveMatchStatus.UNMATCHED):
                suggested = _linked(best)

            rows.append(
                ReconciliationRow(
                    eob_document_id=doc.id,
                    eob_filename=doc.original_filename,
                    claim_index=claim["index"],
                    eob_claim=claim.get("input") or {},
                    status=status,
                    match_score=(best or {}).get("score"),
                    reasons=(claim.get("hitl") or {}).get("reasons") or [],
                    linked=linked,
                    suggested=suggested,
                    review=ClaimReviewRead.model_validate(review) if review else None,
                    matched_at=matched_at,
                    stale=stale,
                )
            )

    summary = Counter(row.status for row in rows)
    if edi_document_id is not None:
        rows = [r for r in rows if r.linked and r.linked.document_id == edi_document_id]
    if status_filter is not None:
        rows = [r for r in rows if r.status is status_filter]
    return ReconciliationResponse(
        summary={s: summary.get(s, 0) for s in EffectiveMatchStatus},
        documents=documents,
        rows=rows,
    )


def rerun_all(db: Session) -> RerunMatchingResponse:
    eob_docs = list(db.scalars(select(Document).where(Document.doc_type == DocType.EOB_835.value)))
    statuses = document_statuses(db, eob_docs)
    metas = load_metas(db, [d.matching_task_id for d in eob_docs])
    queued = skipped = 0
    for doc in eob_docs:
        extraction, matching = statuses[doc.id]
        if extraction.state is not ExtractionState.SUCCEEDED or (matching and matching.state in ACTIVE_STATES):
            skipped += 1
            continue
        previous = successful_result(metas.get(doc.matching_task_id or "")) or {}
        enqueue_matching(db, doc, force=bool(previous.get("forced")))
        queued += 1
    return RerunMatchingResponse(queued=queued, skipped=skipped)
