Phase 8 — Accounts UI

Goal:
Build browser-based chart of accounts management using the existing accounts API.

Requirements:
- Display accounts in a table.
- Add text search.
- Add prefix/category filter.
- Add create account flow.
- Add edit account flow.
- Add delete account flow.
- Show validation/error messages from API.

Likely files to touch:
- frontend/src/pages/Accounts/*
- frontend/src/api/accounts.*
- frontend/src/components/* only if needed

Read constraints:
- Do NOT change backend unless the existing API is clearly broken.
- Do NOT read unrelated frontend pages.
- Do NOT read the full documentation.

Validation:
- Accounts list loads.
- Search/filter works.
- Create/edit/delete works.
- Existing backend tests still pass if backend touched.
