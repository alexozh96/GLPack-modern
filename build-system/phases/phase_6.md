Phase 6 — Authentication

Goal:
Implement backend authentication and access control without rewriting existing business logic.

Requirements:
- Implement JWT authentication.
- POST /auth/login returns access token.
- GET /auth/me returns current user.
- POST /auth/logout handles client-side token discard or deny-list if already designed.
- Protect existing API routes.
- Implement access levels:
  - Level 1 = read only.
  - Level 3 = can enter transactions.
  - Level 6 = full admin.
- Add admin-only user management endpoints.
- Seed default admin:
  - username: admin
  - password: admin123
  - access_level: 6

Likely files to touch:
- backend/app/auth.py
- backend/app/models/user.py
- backend/app/schemas/user.py
- backend/app/schemas/auth.py
- backend/app/routers/auth.py
- backend/app/routers/users.py
- backend/app/main.py
- backend/seed/* only if needed for default admin

Read constraints:
- Do NOT read report service files unless necessary.
- Do NOT read the full documentation.
- Do NOT scan tests unless using them for final validation or a failing error.

Validation:
- Verify login works.
- Verify /auth/me works with token.
- Verify protected route fails without token.
- Verify admin-only route rejects non-admin user if testable.
- Run relevant backend tests.
