Phase 10 — Ledger View

Goal:
Build per-account ledger view with running balance, filters, and PDF export.

Requirements:
- Account selector/search.
- Period start/end filters.
- Transaction table:
  - Date
  - Trx No
  - Particular
  - Debit
  - Credit
  - Running balance
- Clicking Trx No should navigate to journal entry edit flow if available.
- PDF export button calls report PDF endpoint.

Likely files to touch:
- frontend/src/pages/LedgerView/*
- frontend/src/api/reports.*
- frontend/src/api/accounts.*
- frontend/src/App.tsx only if route missing

Read constraints:
- Use existing report endpoint.
- Do NOT recalculate backend report logic.
- Do NOT modify backend unless API mismatch is confirmed.

Validation:
- Ledger page loads.
- Filters work.
- Running balance displays.
- PDF export works.
