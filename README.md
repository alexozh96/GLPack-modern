# GLPack Modern

A full-stack accounting system built with FastAPI and React. Replaces the legacy DBF-based GLPACK system.

## Stack

- **Backend** — Python 3.13, FastAPI, SQLAlchemy 2, SQLite, Alembic
- **Frontend** — React 19, TypeScript, Vite 8, Tailwind CSS 4
- **Package manager** — `uv` (Python), `npm` (Node)

---

## Quick Start

### Prerequisites

- Python 3.13+
- Node 20+
- [uv](https://docs.astral.sh/uv/) — `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`

### 1. Clone and install

```bash
git clone <repo-url>
cd glpack-modern
```

### 2. Backend setup

```bash
cd backend
uv sync                          # install Python dependencies
uv run alembic upgrade head      # run database migrations
uv run python -m seed.run_all    # seed accounts, phrases, and a demo user
```

### 3. Run the backend

```bash
uv run uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 4. Frontend setup

```bash
cd frontend
npm install
```

### 5. Run the frontend

```bash
npm run dev
```

App available at `http://localhost:5173`.

---

## Default Login

After running the seed script:

| Username | Password | Access Level |
|----------|----------|--------------|
| `admin`  | `admin123` | 6 (Admin)  |
| `user`   | `user123`  | 3 (Write)  |

> **Change passwords after first login.**

Access levels: `1` = read-only, `3` = write (journal/phrases), `6` = admin (all + user management, setup, period close).

---

## Project Structure

```
glpack-modern/
├── backend/
│   ├── app/
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── routers/       # FastAPI route handlers
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # Business logic (reports, period close)
│   │   ├── auth.py        # JWT authentication
│   │   ├── database.py    # DB engine and session
│   │   └── main.py        # App factory and router registration
│   ├── migrations/        # Alembic migration files
│   ├── seed/              # Seed scripts
│   ├── tests/             # pytest test suite
│   └── glpack.db          # SQLite database (created on first run)
└── frontend/
    ├── src/
    │   ├── api/           # Axios API client functions
    │   ├── components/    # Shared UI components (Layout, GlobalSearch)
    │   ├── context/       # React contexts (Auth, Toast)
    │   └── pages/         # Page components
    └── vite.config.ts
```

---

## Key Features

| Feature | Endpoint / Route |
|---------|-----------------|
| Dashboard with KPI cards | `/dashboard` |
| Chart of Accounts CRUD | `/accounts` — `GET/POST/PUT/DELETE /accounts` |
| Journal Entry (create/edit/delete) | `/journal` — `GET/POST/PUT/DELETE /journal/{trx_no}` |
| General Ledger view | `/ledger` — `GET /ledger` |
| Reports (P&L, Balance Sheet, Trial Balance, etc.) | `/reports` — `GET /reports/profit-loss` etc. |
| PDF export for all reports | `?format=pdf` on any report endpoint |
| Bank Reconciliation | `/bank-reconciliation` — `POST /reconciliation/import` |
| Period Close | `/settings` — `POST /period/close` |
| CSV Bulk Import | `POST /ledger/import-csv` |
| Global Search | `GET /search?q=` — Ctrl+K in UI |
| Settings / Company setup | `/settings` — `GET/PUT /setup` |

---

## Financial Year Configuration

### Setting the financial year end

Go to **Settings → Company Settings → Financial Year End (MM-DD)** and enter the month and day your financial year ends:

| FY end | Value to enter |
|--------|---------------|
| 30 June | `06-30` |
| 31 December | `12-31` |
| 31 March | `03-31` |

Save the setting. The app derives the current FY start and end dates automatically and rolls them forward each year — you only need to set this once.

### How defaults are applied

Once configured, the financial year dates are used as the default filter on:

- **Dashboard** — automatically selects the *Financial Year* preset and loads KPIs and charts for that range
- **Journal** — date filter inputs are pre-populated with the FY start and end; the initial list loads within that range
- **Ledger** — date inputs are pre-populated; select an account and click Load to view within the FY range

### Overriding the defaults

| Page | How to override |
|------|----------------|
| Dashboard | Click any preset in the strip: **Financial Year \| Year to Date \| This Quarter \| This Month \| Custom**. Custom reveals two date inputs. Changes take effect immediately. |
| Journal | Edit the From / To date fields and click **Apply**. Click **Clear** to remove date filtering entirely. |
| Ledger | Edit the From / To date fields and click **Load**. |

Overrides are session-only — navigating away and back restores the FY defaults.

---

## Running Tests

```bash
cd backend
uv run pytest                    # all tests
uv run pytest -q                 # quiet summary
uv run pytest tests/test_journal.py -v   # single file, verbose
```

All 203 tests should pass on a clean clone.

---

## Common Tasks

### Create a new migration

```bash
cd backend
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
```

### Reset the database

```bash
cd backend
rm glpack.db
uv run alembic upgrade head
uv run python -m seed.run_all
```

### Build the frontend for production

```bash
cd frontend
npm run build       # output in frontend/dist/
```

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'app'`**
Run backend commands from the `backend/` directory, or prefix with `cd backend &&`.

**`CORS error` in browser**
Ensure the backend is running on port 8000 and frontend on 5173. The CORS allowlist in `app/main.py` covers `http://localhost:5173`.

**`401 Unauthorized` on all requests**
Token expired (8-hour sessions). Sign out and log in again.

**`403 Period locked`**
The journal entry date is on or before the locked period end date set in Settings → Period Close. To edit historical entries, the period lock must be cleared by an admin (update `locked_before` key in the setup table directly, or add a UI for unlocking).

**Port already in use**
```bash
# Backend
uv run uvicorn app.main:app --reload --port 8001

# Frontend — set VITE_API_URL if backend port changes
```
