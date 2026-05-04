Phase 14 — Bank Reconciliation

Goal:
Implement CSV bank import and manual matching against GL cash entries.

Requirements:
- Add reconciliation table if not already present.
- POST /reconciliation/import accepts CSV:
  - date
  - description
  - amount
- GET /reconciliation/unmatched returns unmatched bank rows.
- POST /reconciliation/match links bank row to GL ledger row.
- POST /reconciliation/unmatch removes match.
- GET /reconciliation/summary returns matched/unmatched counts.
- Frontend reconciliation page:
  - Left: unmatched bank rows.
  - Right: unmatched GL cash entries.
  - Select bank + GL to match.
  - Show summary.

Likely files to touch:
- backend/app/models/reconciliation.py
- backend/app/routers/reconciliation.py
- backend/app/schemas/reconciliation.py
- backend/app/services/reconciliation.py
- frontend/src/pages/Reconciliation/*
- frontend/src/api/reconciliation.*

Read constraints:
- Keep matching logic simple first.
- Do NOT modify journal/report logic unless necessary for unmatched GL query.
- Do NOT read full documentation.

Validation:
- CSV import works.
- Matching/unmatching works.
- Summary updates.
