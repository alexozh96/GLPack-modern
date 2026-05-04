Phase 16 — Testing & Polish

Goal:
Stabilize the application, improve UX states, and write final README.

Requirements:
Backend:
- Add/confirm critical tests:
  - Unbalanced journal entry returns 422.
  - P&L 2022 net profit matches expected value if sample data available.
  - Period close then edit locked entry returns 423.
- Ensure existing tests pass.

Frontend:
- Loading states for data fetches.
- Error toast notifications.
- Empty states for tables.
- 404 page.
- Basic responsive layout.

Documentation:
- Write README.md with:
  - install steps
  - backend run command
  - frontend run command
  - migration/seed steps
  - default admin login
  - common troubleshooting

Likely files to touch:
- backend/tests/*
- frontend/src/components/*
- frontend/src/pages/*
- README.md

Read constraints:
- Do NOT add new major features.
- Do NOT refactor unnecessarily.
- Focus on reliability.

Validation:
- Backend tests pass.
- Frontend builds.
- README is usable from clean setup.
