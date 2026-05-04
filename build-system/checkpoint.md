=== CHECKPOINT 16 ===

Phase completed:
Phase 16 — Testing & Polish

Completed:
- Phase 0–15 completed prior.
- Backend tests added:
  - test_journal.py: 3 new tests for period lock guard:
      test_update_locked_entry_returns_403 — PUT after period close → 403
      test_delete_locked_entry_returns_403 — DELETE after period close → 403
      test_entry_after_lock_is_editable — entries dated after lock are still editable
  - test_reports_pl.py (new): P&L calculation correctness with seeded data:
      test_pl_net_profit — verifies revenue/COGS/expenses/tax/profit_after_tax = 4500
      test_pl_gross_profit_pct — verifies pct_of_revenue field
      test_pl_zero_revenue_period — no division-by-zero on empty period
- Frontend: Toast notification system:
  - context/ToastContext.tsx: ToastProvider + useToast() hook; auto-dismiss after 4s;
    three levels: success (green), error (red), info (slate); stacks bottom-right.
  - App.tsx: ToastProvider wraps the entire app.
  - Journal.tsx: useToast wired; 403 locked-period errors show a descriptive toast in
    addition to the existing inline error message.
- Frontend: 404 page (pages/NotFound.tsx) — styled, with "Go to Dashboard" button.
  App.tsx: catch-all `path="*"` now renders NotFound instead of redirecting to dashboard.
- README.md: comprehensive setup guide covering prerequisites, install, backend/frontend run
  commands, default logins, project structure, feature table, test commands, common tasks
  (migration, DB reset, production build), and troubleshooting section.

Files changed:
- backend/tests/test_journal.py (modified — 3 lock guard tests appended)
- backend/tests/test_reports_pl.py (new — 3 P&L correctness tests)
- frontend/src/App.tsx (modified — ToastProvider, NotFound route)
- frontend/src/context/ToastContext.tsx (new)
- frontend/src/pages/Journal.tsx (modified — useToast for 403 errors)
- frontend/src/pages/NotFound.tsx (new)
- README.md (new)

Validation performed:
- uv run pytest backend/tests/ -q: 199/199 passed
- npx tsc --noEmit: 0 errors
- npx vite build: ✓ 99 modules, 0 errors, built in 213ms

System state:
- All phases complete. System is production-ready for single-company use.
- 199 backend tests covering all major flows.
- README.md with full setup instructions.
- Toast notifications for critical errors (period lock).
- 404 page for unknown routes.

Known issues / deferred items:
- Token expiry / 401 auto-logout still deferred.
- Phrases management UI not yet implemented (backend /phrases exists).
- Multi-company (company_id) deferred — requires explicit approval.

Key constraints:
- Do NOT modify backend unless there is a clear API mismatch.
- Do NOT modify report calculation logic unless fixing a clearly proven bug.
- Do NOT implement multi-company without explicit user approval.
- Do NOT reload the full GLPACK_DOCUMENTATION.md by default.
- Do NOT scan the entire project unless explicitly required.

Next phase:
No further phases defined.
