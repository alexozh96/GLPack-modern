=== CHECKPOINT 15 ===

Phase completed:
Phase 15 — Modern Improvements (partial: CSV import + global search; multi-company deferred)

Completed:
- Phase 0–14 completed prior.
- Feature 1: CSV Bulk Import (POST /ledger/import-csv):
  - Accepts multipart CSV with columns: date, trx_no, account, particular, dr_amount, cr_amount
    (case-insensitive headers, comma-stripped amounts).
  - All-or-nothing validation: parse errors, unbalanced trx_no groups, unknown accounts,
    duplicate trx_no conflicts with existing DB entries, and period lock all checked before
    any insert. Errors returned as list[str] in HTTP 422 detail.
  - Returns { imported_rows, imported_transactions } on success.
  - WriteAccess required.
  - 7 tests in test_ledger_import.py covering all error paths and happy path.
- Feature 2: Global Search (GET /search?q=):
  - Searches accounts (code + name ILIKE), phrases (phrase ILIKE), ledger particulars
    (grouped by trx_no). Minimum query length: 2 chars. Default limit: 8 per category.
  - New schemas/search.py: AccountResult, PhraseResult, JournalResult, SearchResult.
  - New routers/search.py with GET /search; included in main.py.
  - 6 tests in test_search.py.
  - Frontend api/search.ts: search(q) → SearchResult.
  - Frontend components/GlobalSearch.tsx:
    - Search input in top bar (replaces static header text).
    - 300ms debounce; results popover opens automatically.
    - Grouped results: Accounts, Journal Entries, Phrases.
    - Click account → /accounts; click journal entry → /journal with openTrx state;
      click phrase → /settings.
    - Ctrl+K / Cmd+K keyboard shortcut to focus; Escape to close; click-outside to close.
    - Total result count footer.
  - Layout.tsx updated: GlobalSearch replaces "General Ledger Accounting System" text.

Deferred (multi-company):
- Adding company_id to all data tables (ledger, accounts, phrases, setup, etc.) is a
  destructive migration requiring changes to every model, router, and test. Requires
  explicit approval before proceeding. All existing queries would need company_id filters.

Files changed:
- backend/app/main.py (modified — search router added)
- backend/app/routers/ledger.py (modified — POST /ledger/import-csv added)
- backend/app/routers/search.py (new)
- backend/app/schemas/search.py (new)
- backend/tests/test_ledger_import.py (new)
- backend/tests/test_search.py (new)
- frontend/src/api/search.ts (new)
- frontend/src/components/GlobalSearch.tsx (new)
- frontend/src/components/Layout.tsx (modified — GlobalSearch in header)

Validation performed:
- uv run pytest backend/tests/ -q: 193/193 passed
- npx tsc --noEmit: 0 errors
- npx vite build: ✓ 97 modules, 0 errors, built in 190ms

System state:
- All frontend pages fully implemented.
- CSV bulk import available at POST /ledger/import-csv.
- Global search in top bar, Ctrl+K shortcut.
- Phrases management UI still not implemented (backend /phrases exists).
- Multi-company deferred.

Key constraints:
- Do NOT modify backend unless there is a clear API mismatch.
- Do NOT modify report calculation logic unless fixing a clearly proven bug.
- Do NOT implement multi-company without explicit user approval.
- Do NOT reload the full GLPACK_DOCUMENTATION.md by default.
- Do NOT scan the entire project unless explicitly required.

Next phase:
Phase 16 — Phrases Management UI

Next task:
- Build Phrases management page: list all phrases (phrase, dr_code, cr_code), create new
  (with account selector dropdowns for dr/cr codes), delete. Uses GET/POST/DELETE /phrases.
  Can be a tab within Settings or a standalone route.
