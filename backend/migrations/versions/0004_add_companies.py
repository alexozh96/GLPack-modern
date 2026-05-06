"""Add companies, user_company_access, and company_id to data tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import Boolean, bindparam
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # ── 1. Create companies table ────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="SGD"),
        sa.Column("financial_year_end", sa.String(5), nullable=False, server_default="12-31"),
        sa.Column("current_period", sa.String(10), nullable=True),
        sa.Column("locked_before", sa.String(10), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # ── 2. Seed Company 1 from existing setup table ──────────────────────────
    rows = bind.execute(sa.text("SELECT key, value FROM setup")).fetchall()
    setup = {r[0]: r[1] for r in rows}
    bind.execute(
        sa.text(
            "INSERT INTO companies (id, name, currency, financial_year_end, current_period, locked_before, is_active, created_at) "
            "VALUES (:id, :name, :currency, :fye, :cp, :lb, :is_active, CURRENT_TIMESTAMP)"
        ).bindparams(bindparam("is_active", type_=Boolean())),
        {
            "id": 1,
            "name": setup.get("company_name") or "My Company",
            "currency": setup.get("currency") or "SGD",
            "fye": setup.get("financial_year_end") or "12-31",
            "cp": setup.get("current_period"),
            "lb": setup.get("locked_before"),
            "is_active": True,
        },
    )

    # ── 3. Create user_company_access table ──────────────────────────────────
    op.create_table(
        "user_company_access",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), primary_key=True),
        sa.Column("access_level", sa.Integer(), nullable=False, server_default="1"),
    )

    # ── 4. Seed user_company_access from existing users ──────────────────────
    bind.execute(
        sa.text(
            "INSERT INTO user_company_access (user_id, company_id, access_level) "
            "SELECT id, 1, access_level FROM users"
        )
    )

    # ── 5. Recreate accounts with composite PK (company_id, code) ───────────
    # PostgreSQL enforces FKs — drop the ledger.account → accounts.code FK first.
    if is_pg:
        op.drop_constraint("fk_ledger_account", "ledger", type_="foreignkey")

    op.create_table(
        "accounts_new",
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), primary_key=True),
        sa.Column("code", sa.String(4), primary_key=True),
        sa.Column("name", sa.String(30), nullable=False),
    )
    bind.execute(sa.text("INSERT INTO accounts_new (company_id, code, name) SELECT 1, code, name FROM accounts"))
    op.drop_table("accounts")
    op.rename_table("accounts_new", "accounts")

    # ── 6. Add company_id to ledger ──────────────────────────────────────────
    op.add_column("ledger", sa.Column("company_id", sa.Integer(), nullable=False, server_default="1"))
    bind.execute(sa.text("UPDATE ledger SET company_id = 1"))

    # ── 7. Recreate phrases with company_id and updated unique constraint ────
    op.create_table(
        "phrases_new",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("phrase", sa.String(45), nullable=False),
        sa.Column("dr_code", sa.String(4), nullable=True),
        sa.Column("cr_code", sa.String(4), nullable=True),
        sa.UniqueConstraint("company_id", "phrase", "dr_code", "cr_code", name="uq_phrase_codes"),
    )
    bind.execute(
        sa.text("INSERT INTO phrases_new (id, company_id, phrase, dr_code, cr_code) SELECT id, 1, phrase, dr_code, cr_code FROM phrases")
    )
    op.drop_table("phrases")
    op.rename_table("phrases_new", "phrases")

    # ── 8. Add company_id to bank_rows ───────────────────────────────────────
    op.add_column("bank_rows", sa.Column("company_id", sa.Integer(), nullable=False, server_default="1"))
    bind.execute(sa.text("UPDATE bank_rows SET company_id = 1"))

    # ── 9. Add company_id to audit_log ───────────────────────────────────────
    op.add_column("audit_log", sa.Column("company_id", sa.Integer(), nullable=False, server_default="1"))
    bind.execute(sa.text("UPDATE audit_log SET company_id = 1"))


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    op.drop_column("audit_log", "company_id")
    op.drop_column("bank_rows", "company_id")

    # Restore phrases without company_id
    op.create_table(
        "phrases_old",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("phrase", sa.String(45), nullable=False),
        sa.Column("dr_code", sa.String(4), nullable=True),
        sa.Column("cr_code", sa.String(4), nullable=True),
        sa.UniqueConstraint("phrase", "dr_code", "cr_code", name="uq_phrase_codes"),
    )
    bind.execute(sa.text("INSERT INTO phrases_old (id, phrase, dr_code, cr_code) SELECT id, phrase, dr_code, cr_code FROM phrases"))
    op.drop_table("phrases")
    op.rename_table("phrases_old", "phrases")

    op.drop_column("ledger", "company_id")

    # Restore accounts with single PK; in PostgreSQL re-create FK afterward
    op.create_table(
        "accounts_old",
        sa.Column("code", sa.String(4), primary_key=True),
        sa.Column("name", sa.String(30), nullable=False),
    )
    bind.execute(sa.text("INSERT INTO accounts_old (code, name) SELECT code, name FROM accounts WHERE company_id = 1"))
    op.drop_table("accounts")
    op.rename_table("accounts_old", "accounts")

    if is_pg:
        op.create_foreign_key("fk_ledger_account", "ledger", "accounts", ["account"], ["code"])

    op.drop_table("user_company_access")
    op.drop_table("companies")
