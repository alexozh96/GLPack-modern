"""Add is_system_admin and is_active to users

Revision ID: 0003
Revises: b41723694a62
Create Date: 2026-05-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Boolean, bindparam

revision: str = "0003"
down_revision: Union[str, None] = "b41723694a62"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_system_admin", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))

    bind = op.get_bind()
    bind.execute(
        sa.text("UPDATE users SET is_system_admin = :val WHERE username = 'admin'")
        .bindparams(bindparam("val", type_=Boolean())),
        {"val": True},
    )


def downgrade() -> None:
    op.drop_column("users", "is_active")
    op.drop_column("users", "is_system_admin")
