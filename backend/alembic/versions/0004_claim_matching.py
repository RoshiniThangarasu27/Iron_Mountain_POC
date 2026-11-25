"""claim matching

Revision ID: 0004_claim_matching
Revises: 0003_drop_inspection_fields
Create Date: 2026-11-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004_claim_matching"
down_revision: Union[str, None] = "0003_drop_inspection_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("matching_task_id", sa.String(255), nullable=True))
    op.add_column("documents", sa.Column("matching_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_documents_matching_task_id", "documents", ["matching_task_id"])

    op.create_table(
        "claim_match_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "eob_document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("claim_index", sa.Integer(), nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column(
            "edi_document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("edi_claim_id", sa.String(255), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("eob_document_id", "claim_index", name="uq_claim_match_reviews_eob_claim"),
        sa.CheckConstraint("decision IN ('accepted', 'no_match')", name="ck_claim_match_reviews_decision"),
    )
    op.create_index("ix_claim_match_reviews_eob_document_id", "claim_match_reviews", ["eob_document_id"])
    op.create_index("ix_claim_match_reviews_edi_document_id", "claim_match_reviews", ["edi_document_id"])


def downgrade() -> None:
    op.drop_table("claim_match_reviews")
    op.drop_index("ix_documents_matching_task_id", table_name="documents")
    op.drop_column("documents", "matching_requested_at")
    op.drop_column("documents", "matching_task_id")
