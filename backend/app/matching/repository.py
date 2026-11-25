from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import DocType, Document
from app.services.task_results import load_metas, successful_result


def load_claim_repository(db: Session) -> list[dict[str, Any]]:
    docs = list(
        db.scalars(
            select(Document)
            .where(Document.doc_type == DocType.EDI_837.value, Document.extraction_task_id.is_not(None))
            .order_by(Document.created_at)
        )
    )
    metas = load_metas(db, [d.extraction_task_id for d in docs])
    repository = []
    for doc in docs:
        result = successful_result(metas.get(doc.extraction_task_id or ""))
        claim = (result or {}).get("claim")
        if isinstance(claim, dict):
            repository.append({**claim, "document_id": str(doc.id), "filename": doc.original_filename})
    return repository
