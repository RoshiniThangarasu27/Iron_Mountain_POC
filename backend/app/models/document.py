import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DocType(str, enum.Enum):
    EDI_837 = "edi_837"
    EOB_835 = "eob_835"


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint("doc_type IN ('edi_837', 'eob_835')", name="ck_documents_doc_type"),
        Index("ix_documents_doc_type_created_at", "doc_type", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_type: Mapped[str] = mapped_column(String(20), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    extraction_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    extraction_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    matching_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    matching_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ReviewDecision(str, enum.Enum):
    ACCEPTED = "accepted"
    NO_MATCH = "no_match"


class ClaimMatchReview(Base):
    __tablename__ = "claim_match_reviews"
    __table_args__ = (
        UniqueConstraint("eob_document_id", "claim_index", name="uq_claim_match_reviews_eob_claim"),
        CheckConstraint("decision IN ('accepted', 'no_match')", name="ck_claim_match_reviews_decision"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    eob_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    claim_index: Mapped[int] = mapped_column(Integer, nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    edi_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    edi_claim_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
