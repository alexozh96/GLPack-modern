Phase 12 — Dashboard

Goal:
Build dashboard landing page with key financial metrics and recent activity.

Requirements:
- KPI cards:
  - Total Revenue
  - Gross Profit %
  - Net Profit
  - Cash at Bank
- Monthly chart using existing data or reports API.
- Recent transactions table.
- Quick action buttons:
  - New Journal Entry
  - View Trial Balance
  - Close Period

Likely files to touch:
- frontend/src/pages/Dashboard/*
- frontend/src/api/reports.*
- frontend/src/api/journal.*
- frontend/src/components/* only if needed

Read constraints:
- Use existing APIs where possible.
- Do NOT change backend unless required by missing endpoint.
- Keep dashboard simple.

Validation:
- Dashboard loads.
- KPI cards display.
- Chart renders.
- Recent transactions display or graceful empty state.
