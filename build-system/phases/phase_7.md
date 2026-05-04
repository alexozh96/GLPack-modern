Phase 7 — Frontend Shell

Goal:
Create the React application shell with login, routing, layout, and protected routes.

Requirements:
- Set up React Router.
- Build Login page connected to backend POST /auth/login.
- Store JWT in localStorage.
- Add AuthContext.
- Add ProtectedRoute wrapper.
- Build sidebar navigation with placeholders for:
  - Dashboard
  - Chart of Accounts
  - Journal Entry
  - Ledger View
  - Reports
  - Bank Reconciliation
  - Settings
- Top bar should show logged-in user if available.
- Keep styling functional and clean.

Likely files to touch:
- frontend/src/App.tsx
- frontend/src/main.tsx
- frontend/src/context/AuthContext.tsx
- frontend/src/api/*
- frontend/src/pages/Login/*
- frontend/src/pages/*
- frontend/src/components/*

Read constraints:
- Do NOT modify backend unless there is a clear API mismatch.
- Do NOT read the full documentation.
- Do NOT over-polish UI.

Validation:
- Frontend starts.
- Login page renders.
- Login calls backend successfully.
- Protected routes redirect when unauthenticated.
