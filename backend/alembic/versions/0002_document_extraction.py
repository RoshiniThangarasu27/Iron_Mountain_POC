"""document extraction tasks

Revision ID: 0002_document_extraction
Revises: 0001_create_documents
Create Date: 2026-11-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from celery.backends.database.models import ResultModelBase

from alembic import op

revision: str = "0002_document_extraction"
down_revision: Union[str, None] = "0001_create_documents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("extraction_task_id", sa.String(255), nullable=True))
    op.add_column("documents", sa.Column("extraction_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_documents_extraction_task_id", "documents", ["extraction_task_id"])
    ResultModelBase.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    ResultModelBase.metadata.drop_all(bind=op.get_bind(), checkfirst=True)
    op.drop_index("ix_documents_extraction_task_id", table_name="documents")
    op.drop_column("documents", "extraction_requested_at")
    op.drop_column("documents", "extraction_task_id")
