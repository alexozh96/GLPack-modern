=== CHECKPOINT 9 ===

Phase completed:
Phase 9 — Journal Entry UI

Completed:
- Phase 0–8 completed prior.
- api/journal.ts: listJournals, getJournal, createJournal, updateJournal, deleteJournal.
- api/phrases.ts: listPhrases.
- Journal page with two views (list / form):
  List view:
    - Table: TRX, Date, Description, Debit, Credit, Edit/Delete (write users).
    - Date range filter (from/to) with Apply and Clear buttons.
    - Inline per-row delete confirmation.
  Form view (create + edit):
    - Date input (defaults to today).
    - Dynamic line rows: account combobox, particular combobox, Dr input, Cr input, remove button.
    - Account combobox filters accounts by code or name.
    - Particular combobox filters phrases by text; shows dr_code/cr_code hints in label.
    - Entering Dr clears Cr on the same row (and vice versa).
    - Live total Dr / total Cr / difference display.
    - Save button disabled until balanced (total_dr == total_cr > 0).
    - API error messages surfaced below totals.
    - "Post Entry" for create, "Update Entry" for edit.
- Access control: write controls shown only to users with access_level >= 3.

Files changed:
- frontend/src/api/journal.ts (new)
- frontend/src/api/phrases.ts (new)
- frontend/src/pages/Journal.tsx (rewrite — was placeholder)

Validation performed:
- npx tsc --noEmit: 0 errors
- npx vite build: ✓ 90 modules, 0 errors, built in 175ms

System state:
- Backend API unchanged (no modifications).
- Journal CRUD fully wired to GET/POST/PUT/DELETE /journal.
- Phrases loaded for particular autocomplete (GET /phrases).
- Accounts loaded for account combobox (GET /accounts).

Known issues / deferred items:
- Token expiry / 401 auto-logout still deferred.
- No pagination on the entries list.

Key constraints:
- Do NOT modify backend unless there is a clear API mismatch.
- Do NOT modify report calculation logic unless fixing a clearly proven bug.
- Do NOT reload the full GLPACK_DOCUMENTATION.md by default.
- Do NOT scan the entire project unless explicitly required.

Next phase:
Phase 10 — Ledger View UI

Next task:
- Build ledger view: per-account running balance.
- Wire up GET /ledger/{account} endpoint.
- Show date, TRX, particular, Dr, Cr, running balance columns.
- Add account selector and date range filter.

Resume instruction:
Continue with Phase 10 only. Use build-system/phases/phase_10.md. Do NOT read full documentation.
