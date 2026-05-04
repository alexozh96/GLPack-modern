=== CHECKPOINT 14 ===

Phase completed:
Phase 14 — Bank Reconciliation

Completed:
- Phase 0–13 completed prior.
- Backend BankRow model (models/reconciliation.py):
  - Fields: id, date, description, amount (Numeric 12,2), matched_ledger_id (FK ledger.id,
    nullable, unique for 1-to-1 match), imported_at (DateTime, server_default=now).
- Backend schemas (schemas/reconciliation.py):
  - BankRowRead, GlEntryRead, MatchedPairRead, MatchIn, ImportResult, ReconcSummary.
- Backend router (routers/reconciliation.py — prefix /reconciliation):
  - POST /import: multipart CSV upload (WriteAccess); parses date/description/amount columns
    (case-insensitive header, multi-format date parsing, strips currency symbols from amounts).
  - GET /unmatched: bank rows where matched_ledger_id IS NULL.
  - GET /matched: joined bank_rows + ledger where matched_ledger_id IS NOT NULL.
  - GET /gl-cash: ledger entries for CB* accounts not referenced by any bank row.
  - POST /match: links bank row to ledger entry (409 if either already matched).
  - DELETE /match/{bank_row_id}: clears matched_ledger_id.
  - GET /summary: total/matched/unmatched counts.
- models/__init__.py: BankRow registered.
- app/main.py: reconciliation router included.
- Frontend api/reconciliation.ts: all 7 API functions with full TypeScript types.
- Frontend pages/BankReconciliation.tsx (rewrite from placeholder):
  - Summary bar (total/matched/unmatched badges).
  - CSV import button with file picker; success/error message (WriteAccess only).
  - Two-column selection: unmatched bank rows (left) / unmatched GL cash entries (right).
    Click to select/deselect; selected row highlighted with blue left border.
  - Match Selected button (enabled when one of each selected); error banner on failure.
  - Matched pairs table at bottom: bank date/desc/amount, GL trx/particular/dr-cr,
    Unmatch button per row (WriteAccess only).
  - Promise.allSettled for graceful loading; 80-unit max-height scroll on selection columns.
- backend/tests/test_reconciliation.py: 8 tests covering import, unmatched, GL cash,
  match/unmatch, duplicate match rejection, and summary counts.

Files changed:
- backend/app/main.py (modified — reconciliation router added)
- backend/app/models/__init__.py (modified — BankRow registered)
- backend/app/models/reconciliation.py (new)
- backend/app/routers/reconciliation.py (new)
- backend/app/schemas/reconciliation.py (new)
- backend/tests/test_reconciliation.py (new)
- frontend/src/api/reconciliation.ts (new)
- frontend/src/pages/BankReconciliation.tsx (rewrite)

Validation performed:
- uv run pytest backend/tests/ -q: 180/180 passed
- npx tsc --noEmit: 0 errors
- npx vite build: ✓ 95 modules, 0 errors, built in 219ms

System state:
- All frontend pages fully implemented: Dashboard, Accounts, Journal, Ledger, Reports,
  Settings, Bank Reconciliation.
- Full accounting workflow complete end-to-end.

Known issues / deferred items:
- Token expiry / 401 auto-logout still deferred.
- Phrases management UI not yet implemented (backend /phrases exists).
- GL cash query only matches CB* prefix accounts; extend if other cash accounts are used.

Key constraints:
- Do NOT modify backend unless there is a clear API mismatch.
- Do NOT modify report calculation logic unless fixing a clearly proven bug.
- Do NOT reload the full GLPACK_DOCUMENTATION.md by default.
- Do NOT scan the entire project unless explicitly required.

Next phase:
Phase 15 — Phrases Management UI

Next task:
- Build Phrases management page within Settings or as standalone: list all phrases (with
  dr_code/cr_code), create new phrase (account selectors for dr/cr), delete. Uses existing
  GET/POST/DELETE /phrases backend endpoints.
