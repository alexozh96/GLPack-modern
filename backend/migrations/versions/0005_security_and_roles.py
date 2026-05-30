"""Security hardening and multi-tier role system

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-30

Changes:
  users table:
    - add platform_role VARCHAR(20) NOT NULL DEFAULT 'user'
    - add must_change_password BOOLEAN NOT NULL DEFAULT false
    - migrate is_system_admin=True  → platform_role='owner'
    - drop is_system_admin
    - drop access_level  (per-company level lives in user_company_access, unchanged)
  token_deny table:
    - add expires_at DATETIME NULL
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Boolean, bindparam

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # ── users: add platform_role ─────────────────────────────────────────────
    op.add_column("users", sa.Column(
        "platform_role", sa.String(20), nullable=False, server_default="user"
    ))

    # Promote existing system admins to 'owner'
    bind.execute(
        sa.text("UPDATE users SET platform_role = 'owner' WHERE is_system_admin = :val")
        .bindparams(bindparam("val", type_=Boolean())),
        {"val": True},
    )

    # ── users: add must_change_password ──────────────────────────────────────
    # Use sa.false() (proper SQL literal) not the string "false" — SQLite would
    # store the text "false" which Python's bool() evaluates as True.
    op.add_column("users", sa.Column(
        "must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()
    ))

    # ── users: drop old columns ──────────────────────────────────────────────
    op.drop_column("users", "is_system_admin")
    op.drop_column("users", "access_level")

    # ── token_deny: add expires_at ───────────────────────────────────────────
    op.add_column("token_deny", sa.Column("expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()

    # Restore token_deny
    op.drop_column("token_deny", "expires_at")

    # Restore users columns
    op.add_column("users", sa.Column(
        "access_level", sa.Integer(), nullable=False, server_default="1"
    ))
    op.add_column("users", sa.Column(
        "is_system_admin", sa.Boolean(), nullable=False, server_default="false"
    ))

    bind.execute(
        sa.text("UPDATE users SET is_system_admin = :val WHERE platform_role = 'owner'")
        .bindparams(bindparam("val", type_=Boolean())),
        {"val": True},
    )
    bind.execute(sa.text("UPDATE users SET access_level = 6 WHERE platform_role = 'owner'"))
    bind.execute(sa.text("UPDATE users SET access_level = 1 WHERE platform_role != 'owner'"))

    op.drop_column("users", "must_change_password")
    op.drop_column("users", "platform_role")
