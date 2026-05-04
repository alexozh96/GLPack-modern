Phase 15 — Modern Improvements

Goal:
Add CSV bulk import, multi-company support, and global search.

Requirements:
1. CSV Bulk Import
- POST /ledger/import-csv accepts:
  - date
  - trx_no
  - account
  - particular
  - dr_amount
  - cr_amount
- Validate all rows.
- Check balance per trx_no.
- Reject whole file if any row fails.
- Return detailed errors.

2. Multi-Company
- Add companies table.
- Add company_id to data tables where appropriate.
- Add company switcher in frontend.
- Seed:
  - Event Master 2020
  - Demo Company

3. Global Search
- GET /search?q= searches:
  - ledger particulars
  - account names
  - phrases
- Frontend top-nav search popover.

Likely files to touch:
- backend/app/models/company.py
- backend/app/models/*
- backend/app/routers/search.py
- backend/app/routers/ledger*.py
- backend/app/services/import_csv.py
- frontend/src/components/CompanySwitcher/*
- frontend/src/components/GlobalSearch/*
- frontend/src/api/*

Read constraints:
- This is broad. Work incrementally.
- Do NOT rewrite existing business logic.
- Preserve existing data.
- Ask before large migrations/destructive changes.

Validation:
- Existing app still works with default company.
- CSV import rejects invalid files clearly.
- Company switcher works.
- Search returns grouped results.
