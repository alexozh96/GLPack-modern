"""Normalize boolean columns from text to integer in SQLite

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-30

SQLite's DEFAULT 'true'/'false' (text) is not equivalent to INTEGER 1/0.
SQLAlchemy's Boolean type stores and queries as integers, so text defaults
cause .is_(True) filters to silently miss rows.

This migration converts any remaining text boolean values to integers.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        return

    for table, col in [
        ("companies", "is_active"),
        ("users", "is_active"),
        ("users", "must_change_password"),
    ]:
        bind.execute(sa.text(f"UPDATE {table} SET {col} = 1 WHERE {col} = 'true'"))
        bind.execute(sa.text(f"UPDATE {table} SET {col} = 0 WHERE {col} = 'false'"))


def downgrade() -> None:
    pass  # integer 0/1 is the correct canonical form; no rollback needed
