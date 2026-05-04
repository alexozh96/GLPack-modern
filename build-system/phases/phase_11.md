Phase 11 — Reports UI

Goal:
Build UI for all financial reports using existing Reports API.

Requirements:
- Reports page with tabs:
  - Trial Balance
  - Profit & Loss
  - Balance Sheet
  - Expense Schedule
  - Debtors Listing
  - Creditors Listing
  - Fixed Assets
- Period selector.
- Generate button.
- Render report data in tables.
- Add PDF download per report.
- Add Download All / Full Financial Statements PDF.

Likely files to touch:
- frontend/src/pages/Reports/*
- frontend/src/api/reports.*
- frontend/src/components/* only if needed

Read constraints:
- Do NOT recalculate report logic in frontend beyond display formatting.
- Do NOT change backend unless endpoint mismatch is confirmed.
- Do NOT read full documentation.

Validation:
- Each report tab renders.
- Period selector works.
- PDF downloads work.
