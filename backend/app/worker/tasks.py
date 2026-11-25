import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from celery.exceptions import Ignore, SoftTimeLimitExceeded

from app.db.session import SessionLocal
from app.extractors.claim_extractor import extract_claim
from app.extractors.eob_extractor import TRANSIENT_ERRORS, extract_eob
from app.extractors.errors import ExtractionError
from app.matching.claim_matcher import ClaimMatcher
from app.matching.errors import MatchingError
from app.matching.hitl import evaluate_match
from app.matching.mapper import to_match_input
from app.matching.repository import load_claim_repository
from app.models.document import DocType, Document
from app.services.storage import StorageError, resolve_storage_path
from app.services.task_results import load_metas, successful_result
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

EXTRACT_TASK_NAME = "documents.extract"
MATCH_TASK_NAME = "documents.match_claims"


def _is_current(document_id: str, task_id: str, field: str = "extraction_task_id") -> bool:
    with SessionLocal() as db:
        doc = db.get(Document, uuid.UUID(document_id))
        return doc is not None and getattr(doc, field) == task_id


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


@celery_app.task(bind=True, name=MATCH_TASK_NAME)
def match_claims(
    self, extraction_result: dict[str, Any] | None, document_id: str, force: bool = False
) -> dict[str, Any]:
    with SessionLocal() as db:
        doc = db.get(Document, uuid.UUID(document_id))
        if doc is None or doc.matching_task_id != self.request.id:
            self.backend.forget(self.request.id)
            raise Ignore()
        if not isinstance(extraction_result, dict):
            meta = load_metas(db, [doc.extraction_task_id]).get(doc.extraction_task_id or "")
            extraction_result = successful_result(meta)
            if extraction_result is None:
                raise MatchingError("EOB extraction has not completed successfully")
        self.update_state(state="PROGRESS", meta={"step": "loading_claims"})
        repository = load_claim_repository(db)

    payload = extraction_result.get("payload") or {}
    extraction_review = extraction_result.get("review") or {}
    base = {
        "document_id": document_id,
        "matched_at": datetime.now(timezone.utc).isoformat(),
        "repository_size": len(repository),
        "repository_document_ids": sorted({claim["document_id"] for claim in repository}),
        "forced": force,
    }

    if extraction_review.get("required") and not force:
        return {
            **base,
            "skipped": True,
            "skip_reason": extraction_review.get("reason") or "Extraction requires human review",
            "claims": [],
        }

    self.update_state(state="PROGRESS", meta={"step": "matching_claims"})
    matcher = ClaimMatcher()
    claims = []
    for index, eob_claim in enumerate(payload.get("claims") or []):
        if not isinstance(eob_claim, dict):
            continue
        match_input = to_match_input(eob_claim)
        result = matcher.match(match_input, repository)
        claims.append(
            {
                "index": index,
                "input": match_input,
                "best_match": result["best_match"],
                "candidates": result["top_candidates"],
                "hitl": evaluate_match(result),
            }
        )

    if not _is_current(document_id, self.request.id, "matching_task_id"):
        self.backend.forget(self.request.id)
        raise Ignore()

    logger.info(
        "Matched %d EOB claims for document %s against %d 837 claims", len(claims), document_id, len(repository)
    )
    return {**base, "skipped": False, "skip_reason": None, "claims": claims}
