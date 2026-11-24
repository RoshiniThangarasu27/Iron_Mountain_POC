"""drop status and parsed_summary

Revision ID: 0003_drop_inspection_fields
Revises: 0002_document_extraction
Create Date: 2026-11-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003_drop_inspection_fields"
down_revision: Union[str, None] = "0002_document_extraction"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_documents_status", "documents", type_="check")
    op.drop_column("documents", "status")
    op.drop_column("documents", "parsed_summary")


def downgrade() -> None:
    op.add_column("documents", sa.Column("parsed_summary", postgresql.JSONB(), nullable=True))
    op.add_column("documents", sa.Column("status", sa.String(20), nullable=False, server_default="uploaded"))
    op.create_check_constraint("ck_documents_status", "documents", "status IN ('uploaded', 'parsed', 'failed')")
