"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("code", sa.String(4), primary_key=True),
        sa.Column("name", sa.String(30), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(20), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("access_level", sa.Integer(), nullable=False, server_default="1"),
    )

    op.create_table(
        "phrases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("phrase", sa.String(45), nullable=False),
        sa.Column("dr_code", sa.String(4), nullable=True),
        sa.Column("cr_code", sa.String(4), nullable=True),
        sa.UniqueConstraint("phrase", "dr_code", "cr_code", name="uq_phrase_codes"),
    )

    op.create_table(
        "ledger",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("trx_no", sa.String(4), nullable=False),
        sa.Column("account", sa.String(4), sa.ForeignKey("accounts.code"), nullable=False),
        sa.Column("particular", sa.String(45), nullable=False),
        sa.Column("dr_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("cr_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.create_index("ix_ledger_trx_no", "ledger", ["trx_no"])
    op.create_index("ix_ledger_date", "ledger", ["date"])
    op.create_index("ix_ledger_account", "ledger", ["account"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("ledger_id", sa.Integer(), sa.ForeignKey("ledger.id"), nullable=True),
        sa.Column("old_values", sa.Text(), nullable=True),
        sa.Column("new_values", sa.Text(), nullable=True),
    )

    op.create_table(
        "setup",
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("value", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_index("ix_ledger_account", table_name="ledger")
    op.drop_index("ix_ledger_date", table_name="ledger")
    op.drop_index("ix_ledger_trx_no", table_name="ledger")
    op.drop_table("ledger")
    op.drop_table("setup")
    op.drop_table("phrases")
    op.drop_table("users")
    op.drop_table("accounts")
