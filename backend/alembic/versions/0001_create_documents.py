"""create documents table

Revision ID: 0001_create_documents
Revises:
Create Date: 2026-11-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001_create_documents"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("doc_type", sa.String(20), nullable=False),
        sa.Column("original_filename", sa.String(512), nullable=False),
        sa.Column("stored_filename", sa.String(512), nullable=False),
        sa.Column("storage_path", sa.String(1024), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="uploaded"),
        sa.Column("parsed_summary", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("doc_type IN ('edi_837', 'eob_835')", name="ck_documents_doc_type"),
        sa.CheckConstraint("status IN ('uploaded', 'parsed', 'failed')", name="ck_documents_status"),
        sa.UniqueConstraint("stored_filename", name="uq_documents_stored_filename"),
    )
    op.create_index("ix_documents_sha256_hash", "documents", ["sha256_hash"])
    op.create_index("ix_documents_doc_type_created_at", "documents", ["doc_type", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_documents_doc_type_created_at", table_name="documents")
    op.drop_index("ix_documents_sha256_hash", table_name="documents")
    op.drop_table("documents")
