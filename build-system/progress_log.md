## Reconstructed baseline — Phase 5

Phase 5 was completed before the checkpointing system was installed.

Known limitation:
- Exact files changed and validation commands were not captured.
- Starting checkpoint was reconstructed from known project state.

---

## Phase 6 — Authentication (2026-05-04)

All auth code was already written. Fixed a fixture conflict in two self-protection tests
(`test_cannot_demote_self`, `test_cannot_delete_self`) where requesting both `client`
and `raw_client` in the same test caused `get_current_user` to be overridden with the
mock admin (id=999), bypassing the `user.id == admin.id` guard. Removed unused `client`
parameter from both tests.

Validation: 43/43 tests passed (`test_auth.py` + `test_users.py`).

Next phase: Phase 7 — Frontend Shell

## Phase 7 — Frontend Shell (2026-05-04)
- Built React frontend shell: AuthContext, ProtectedRoute, Layout with sidebar, Login page, 7 placeholder pages.
- React Router v7 routing with nested protected routes.
- Vite build clean (0 errors, 87 modules). Dev server starts in 277ms.
- Fixed Rolldown type-only import issue with `import type`.


## Phase 8 — Accounts UI (2026-05-04)
- Built full Chart of Accounts CRUD: list, search, prefix filter, create/edit modal, inline delete confirm.
- Admin-only write controls (access_level >= 6). API errors surfaced in UI.
- Vite build clean (0 errors, 88 modules).


## Phase 9 — Journal Entry UI (2026-05-04)
- Built full journal entry workflow: list with date filter, create/edit form with dynamic rows.
- Account combobox (code+name filter) and particular combobox (phrases with dr/cr hints).
- Live balance indicator; Save disabled until balanced. Entering Dr clears Cr on same row.
- Vite build clean (0 errors, 90 modules).


## Phase 10 — Ledger View UI (2026-05-04)
- Built ledger view: account selector, date range filter, running balance table with Dr/Cr labels, totals footer.
- PDF export via blob download from /reports/ledger-account/{code}?format=pdf.
- TRX click navigates to journal edit form via React Router location state.
- Vite build clean (0 errors, 92 modules).


## Phase 11 — Reports UI (2026-05-04)
- Built full Reports page: 7 tabs, shared period picker, Generate + PDF export per tab, Download All button.
- Dedicated renderer per report type with shared table building blocks.
- Updated api/reports.ts with all 7 report types, JSON fetchers, and generic PDF downloader.
- Vite build clean (0 errors, 92 modules).


## Phase 12 — Dashboard (2026-05-04)
- Built dashboard: 4 KPI cards (Revenue, Gross Profit %, Net Profit, YTD entries), CSS bar chart
  for monthly volume, quick actions panel, recent entries table.
- Promise.allSettled for graceful partial failure; loading skeletons for KPI cards.
- Vite build clean (0 errors, 92 modules).


## Phase 16 — Testing & Polish (2026-05-04)
- Backend: 6 new tests — 3 period lock guard (PUT/DELETE → 403, post-lock editable),
  3 P&L correctness (net profit 4500 from seeded data, pct_of_revenue, zero-revenue safety).
- Frontend: toast notification system (ToastProvider, useToast hook, auto-dismiss 4s);
  Journal wires 403 locked-period errors to toast; 404 page with dashboard link.
- README.md: full setup guide (install, run, default logins, structure, troubleshooting).
- Pytest: 199/199 passed. Vite build: 99 modules, 0 errors.


## Phase 15 — Modern Improvements (2026-05-04)
- CSV bulk import: POST /ledger/import-csv accepts date/trx_no/account/particular/dr/cr CSV,
  all-or-nothing validation (parse, balance, accounts, duplicates, period lock), 7 tests.
- Global search: GET /search?q= across accounts, ledger particulars, phrases; grouped results
  popover in header with Ctrl+K shortcut, 300ms debounce, click-to-navigate. 6 tests.
- Multi-company deferred (destructive migration requiring explicit approval).
- Pytest: 193/193 passed. Vite build: 97 modules, 0 errors.


## Phase 14 — Bank Reconciliation (2026-05-04)
- Backend: BankRow model (date, description, amount, matched_ledger_id FK, imported_at).
  7 endpoints: CSV import (multi-format date/amount parsing), unmatched bank rows, matched pairs
  (joined query), unmatched GL cash (CB* accounts not yet matched), match, unmatch, summary.
- Frontend: two-column click-to-select UI (bank rows left, GL entries right), Match Selected
  button, matched pairs table with Unmatch, summary badges, CSV file import button.
- 8 new backend tests. Pytest: 180/180 passed. Vite build: 95 modules, 0 errors.


## Phase 13 — Period Close (2026-05-04)
- Backend period close service: queries cumulative P&L account balances (SA*/CO*/OI*/EX*/TX*),
  posts a single balanced BALANCE CARRIED DOWN closing entry on period_end, transfers net
  profit/loss to PL* account (auto-created as PL01 if absent). Stores locked_before in Setup.
- Journal lock guard: PUT/DELETE reject entries on or before locked_before with HTTP 403.
- Setup schema/router: added locked_before field to SetupRead, SetupUpdate, and _KEYS.
- New POST /period/close endpoint (AdminAccess); new period router wired into main.py.
- Frontend Settings page (rewrite): company settings panel (admin save), period close panel
  with date picker, confirmation modal, locked_through display, success/error banners.
- New frontend api/setup.ts and api/period.ts.
- Pytest: 172/172 passed. Vite build: 94 modules, 0 errors.

