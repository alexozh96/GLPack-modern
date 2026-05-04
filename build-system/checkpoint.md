=== CHECKPOINT 11 ===

Phase completed:
Phase 11 — Reports UI

Completed:
- Phase 0–10 completed prior.
- api/reports.ts (updated):
  - All 7 report TypeScript types (TrialBalanceReport, ProfitLossReport, BalanceSheetReport,
    ExpenseScheduleReport, DebtorsListingReport, CreditorsListingReport, FixedAssetsReport).
  - JSON fetchers: getTrialBalance, getProfitLoss, getBalanceSheet, getExpenseSchedule,
    getDebtorsListing, getCreditorsListing, getFixedAssets.
  - Generic downloadReportPdf(key, ps, pe) covers all 7 report PDF exports.
  - downloadFullStatementsPdf(ps, pe) for full financial statements bundle.
  - downloadLedgerPdf refactored to use shared blobDownload helper (no behaviour change).
- Reports page (pages/Reports.tsx):
  - 7 tabs: Trial Balance, Profit & Loss, Balance Sheet, Expense Schedule,
    Debtors Listing, Creditors Listing, Fixed Assets.
  - Shared period_start / period_end date pickers.
  - Generate button (disabled until both dates set); fetches JSON for active tab.
  - Export PDF button (visible after report is generated); downloads PDF for active tab.
  - Download All (PDF) button in header (visible when dates set); downloads full statements.
  - Switching tabs clears report data (user must re-generate).
  - Dedicated renderer per report type: TrialBalanceView, ProfitLossView,
    BalanceSheetView, ExpenseScheduleView, SimpleListingView, FixedAssetsView.
  - Shared table building blocks: Th, SectionHead, DataRow, TotalRow, SummaryRow.
  - API error messages surfaced in error banner.

Files changed:
- frontend/src/api/reports.ts (extended — kept downloadLedgerPdf, added all types and functions)
- frontend/src/pages/Reports.tsx (rewrite — was placeholder)

Validation performed:
- npx tsc --noEmit: 0 errors
- npx vite build: ✓ 92 modules, 0 errors, built in 202ms

System state:
- Backend API unchanged (no modifications).
- All 7 financial reports wired to GET /reports/* endpoints.
- PDF exports use blob download via shared blobDownload helper.
- Full financial statements bundle via GET /reports/full-financial-statements?format=pdf.

Known issues / deferred items:
- Token expiry / 401 auto-logout still deferred.

Key constraints:
- Do NOT modify backend unless there is a clear API mismatch.
- Do NOT modify report calculation logic unless fixing a clearly proven bug.
- Do NOT reload the full GLPACK_DOCUMENTATION.md by default.
- Do NOT scan the entire project unless explicitly required.

Next phase:
Phase 12 — Settings & Phrases UI

Next task:
- Build Settings page: company name and other setup fields (GET/PUT /setup).
- Build Phrases management: list, create, delete phrases (GET/POST/DELETE /phrases).

Resume instruction:
Continue with Phase 12 only. Use build-system/phases/phase_12.md. Do NOT read full documentation.
