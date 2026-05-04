Phase 13 — Period Close

Goal:
Implement period close workflow with carry-down, bring-down, and locked periods.

Requirements:
- Backend POST /period/close accepts period_end date.
- Calculate closing balance for accounts with transactions.
- Create BALANCE CARRIED DOWN entries.
- Create BALANCE BROUGHT DOWN entries for next period.
- Store locked_before date in setup/config.
- Prevent editing ledger entries before locked_before.
- Frontend Settings page section for period close.
- Confirmation dialog before closing.
- Show current period/lock status.

Likely files to touch:
- backend/app/routers/period.py
- backend/app/services/period_close.py
- backend/app/services/journal.py
- backend/app/routers/journal*.py
- backend/app/models/*
- frontend/src/pages/Settings/*
- frontend/src/api/period.*

Read constraints:
- Data integrity is critical.
- Do NOT modify reports except if they need to respect locked period metadata.
- Do NOT read full documentation.
- If exact accounting convention is unclear, ask before proceeding.

Validation:
- Period close creates entries.
- Locked entries cannot be edited.
- Relevant tests pass.
