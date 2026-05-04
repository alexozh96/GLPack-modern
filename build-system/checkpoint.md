=== CHECKPOINT 12 ===

Phase completed:
Phase 12 — Dashboard

Completed:
- Phase 0–11 completed prior.
- Dashboard page (pages/Dashboard.tsx):
  - YTD period computed automatically (Jan 1 of current year → today).
  - 4 KPI cards: Total Revenue, Gross Profit %, Net Profit (after tax), Journal Entries (YTD).
    - Revenue/profit from GET /reports/profit-loss (current year period).
    - Entry count from GET /journal (filtered to current year).
  - Monthly transaction volume bar chart: CSS-only, last 12 months of journal Dr totals,
    tooltips on hover, month labels below bars.
  - Quick Actions panel: New Journal Entry (write-only), Chart of Accounts,
    Trial Balance → Reports, Financial Statements → Reports.
  - Recent Journal Entries table: last 8 entries sorted desc by date, clickable rows
    navigate to /journal.
  - Graceful partial failure: Promise.allSettled used — dashboard renders even if one
    API call fails, with amber warning banner.
  - Loading skeleton for KPI cards (animate-pulse placeholders).
- No backend changes, no new API files (uses existing getProfitLoss + listJournals).

Files changed:
- frontend/src/pages/Dashboard.tsx (rewrite — was placeholder)

Validation performed:
- npx tsc --noEmit: 0 errors
- npx vite build: ✓ 92 modules, 0 errors, built in 190ms

System state:
- All frontend pages implemented: Dashboard, Accounts, Journal, Ledger, Reports,
  plus Settings and BankReconciliation remain as placeholders.
- Full frontend-to-backend wiring complete for core accounting workflows.

Known issues / deferred items:
- Token expiry / 401 auto-logout still deferred.
- Settings page (GET/PUT /setup) not yet implemented.
- Phrases management UI not yet implemented.
- Bank Reconciliation page is a placeholder (no backend endpoint).

Key constraints:
- Do NOT modify backend unless there is a clear API mismatch.
- Do NOT modify report calculation logic unless fixing a clearly proven bug.
- Do NOT reload the full GLPACK_DOCUMENTATION.md by default.
- Do NOT scan the entire project unless explicitly required.

Next phase:
Phase 13 — Settings & Phrases UI

Next task:
- Build Settings page: company name and other setup key/value fields (GET /setup, PUT /setup/{key}).
- Build Phrases management within Settings: list, create (with dr_code/cr_code), delete.

Resume instruction:
Continue with Phase 13 only. Use build-system/phases/phase_13.md. Do NOT read full documentation.
