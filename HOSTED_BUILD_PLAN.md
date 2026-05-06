# GLPack Modern — Hosted Multi-Tenant Build Plan

## Purpose of this document

This is the working specification for converting GLPack Modern from a single-company local app into a hosted, multi-tenant accounting platform. It is written so that any Claude Code / Codex session can read it, determine the current phase, and continue work without needing prior context.

**Before starting any phase:** read this document, check which phases are marked ✅ complete, and begin at the first incomplete phase.

---

## Current Architecture (baseline — before any phase work)

### Stack
- **Backend:** Python 3.13+, FastAPI, SQLAlchemy 2.0 (ORM), Alembic (migrations), SQLite
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router DOM 7, Axios
- **Auth:** JWT (HS256, 8-hour expiry), bcrypt password hashing, token revocation via `token_deny` table
- **Package manager (backend):** `uv` — use `uv run` for all Python commands
- **Working directory:** project root is `GLPack-Modern/`; backend lives in `backend/`, frontend in `frontend/`

### Key files
| File | Purpose |
|---|---|
| `backend/app/main.py` | FastAPI app factory, CORS config, router registration |
| `backend/app/database.py` | SQLAlchemy engine, `Base`, `get_db` dependency |
| `backend/app/auth.py` | `create_token`, `get_current_user`, `require_level`, `CurrentUser`, `WriteAccess`, `AdminAccess` |
| `backend/app/models/` | ORM models (one file per table) |
| `backend/app/routers/` | Route handlers (one file per domain) |
| `backend/app/schemas/` | Pydantic request/response schemas |
| `backend/app/services/` | Business logic (reports, PDF, period close) |
| `backend/migrations/versions/` | Alembic migration scripts |
| `backend/seed/` | One-time data seed scripts (DBF import) |
| `frontend/src/api/` | Axios API client functions (one file per domain) |
| `frontend/src/pages/` | Page components |
| `frontend/src/context/` | `AuthContext`, `SetupContext`, `ToastContext` |
| `frontend/src/components/` | `Layout`, `ProtectedRoute`, `GlobalSearch`, `TableControls` |

### Current database tables
| Table | Key columns | Notes |
|---|---|---|
| `users` | `id`, `username`, `password_hash`, `access_level` (1/3/6) | No company link, no is_admin flag |
| `accounts` | `code` (PK, 4-char), `name` | No company link |
| `ledger` | `id`, `date`, `trx_no`, `account` (FK→accounts.code), `particular`, `dr_amount`, `cr_amount` | No company link |
| `phrases` | `id`, `phrase`, `dr_code`, `cr_code` | No company link |
| `setup` | `key` (PK), `value` | Flat key-value, single company config |
| `audit_log` | `id`, `changed_at`, `user_id` (FK), `action`, `ledger_id` (FK), `old_values`, `new_values` | No company link |
| `token_deny` | `jti` (PK) | Revoked JWT IDs |
| `bank_rows` | `id`, `date`, `description`, `amount`, `matched_ledger_id` (FK, nullable) | No company link |

### Access levels (current)
- `1` — read-only (any authenticated user)
- `3` — write (create/edit journal entries and phrases)
- `6` — admin (user management, chart of accounts, setup, period close)

The `access_level` is a single global integer on the `users` row — it applies to the one company in the database.

### Auth flow (current)
1. `POST /auth/login` → returns `{access_token, token_type}`
2. Token stored in `localStorage` (`token` key)
3. Axios interceptor adds `Authorization: Bearer {token}` to every request
4. `get_current_user` dependency decodes JWT, checks `token_deny`, returns `User`
5. `POST /auth/logout` → stores JTI in `token_deny`, invalidating the token
6. On 401 response → frontend clears localStorage and redirects to `/login`

### Default seed users
- `admin` / `admin123` — access_level 6
- `user` / `user123` — access_level 3

### Setup keys (current single-company config)
`company_name`, `currency`, `financial_year_end`, `current_period`, `locked_before`

---

## Target Architecture (after all phases)

- Any number of **companies** in the system
- A **system admin** (the service owner) can create users and companies, and assign users to companies
- Users log in, see the company/companies they have access to, select one, and work within it
- All data (accounts, ledger, phrases, etc.) is isolated per company
- Company-level access: a user can be read-only in one company and admin in another
- Hosted on a cloud provider with PostgreSQL (not SQLite)

---

## Phase Checklist

- [x] **Phase 1** — System admin & user management
- [x] **Phase 2** — Companies data model
- [x] **Phase 3** — Company-scoped API
- [x] **Phase 4** — Frontend multi-company flow
- [x] **Phase 5** — Production hosting (PostgreSQL + deployment)

Mark a phase `[x]` when all its acceptance criteria are met.

---

## Phase 1 — System Admin & User Management

**Status:** ⬜ Not started

**Goal:** The service owner (system admin) can manage all user accounts from a dedicated admin page. No multi-company yet — this is purely about separating "system admin" from "company admin" and giving the admin a clean UI to control who has access.

### What changes

#### Backend

**`backend/app/models/user.py`** — add two columns:
```python
is_system_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="0")
is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
```

`is_active = False` is a soft-delete / deactivation flag. Deactivated users cannot log in but their audit trail is preserved.

**`backend/app/auth.py`** — update `get_current_user` to reject inactive users:
```python
if not user.is_active:
    raise exc
```

Add a new dependency shorthand:
```python
SystemAdmin = Annotated[User, Depends(require_system_admin)]
```

Where `require_system_admin` raises 403 if `user.is_system_admin` is False.

**`backend/app/routers/users.py`** — modify existing + add endpoints:
- `GET /users` — already exists; gate with `SystemAdmin` instead of `AdminAccess`
- `POST /users` — already exists; gate with `SystemAdmin`
- `GET /users/{id}` — already exists; gate with `SystemAdmin`
- `PUT /users/{id}` — already exists; gate with `SystemAdmin`; allow updating `is_active`
- `DELETE /users/{id}` — change to deactivate (set `is_active = False`) rather than hard delete, to preserve audit trail

**`backend/app/schemas/user.py`** — add `is_system_admin` and `is_active` to `UserRead`; add `is_active` to `UserUpdate`.

**Alembic migration** — new file in `backend/migrations/versions/`:
```
- Add users.is_system_admin (Boolean, default False)
- Add users.is_active (Boolean, default True)
- UPDATE users SET is_system_admin = 1 WHERE username = 'admin'
```

**`backend/seed/seed_users.py`** — set `is_system_admin=True` for the admin seed user.

#### Frontend

**New page: `frontend/src/pages/Admin.tsx`**

Accessible only to users where `me.is_system_admin === true`. Contains:
- User list table: columns `id`, `username`, `access_level`, `is_active`, `is_system_admin`, actions
- "New user" button → inline form or modal: `username`, `password`, `access_level` (dropdown 1/3/6)
- Per-row actions: Edit (username, password reset, access level), Deactivate / Reactivate toggle
- Cannot deactivate yourself

**`frontend/src/api/users.ts`** — add `deactivateUser(id)` and `reactivateUser(id)` API calls (both call `PUT /users/{id}` with `{is_active: false/true}`).

**`frontend/src/context/AuthContext.tsx`** — expose `user.is_system_admin` so the nav can show/hide the Admin link.

**`frontend/src/components/Layout.tsx`** — add "Admin" nav item, shown only when `user.is_system_admin === true`.

**`frontend/src/App.tsx`** — add route `/admin` → `<Admin />` inside `ProtectedRoute`.

### Acceptance criteria
- [ ] `admin` user has `is_system_admin = true` after migration
- [ ] System admin can create a new user with any access level
- [ ] System admin can deactivate a user; that user cannot log in afterwards
- [ ] System admin can reactivate a deactivated user
- [ ] System admin can reset a user's password
- [ ] Non-system-admin users get 403 on all `/users` endpoints
- [ ] Admin nav link is visible only to system admins
- [ ] Existing `admin` / `user` / `user123` accounts still work after migration

---

## Phase 2 — Companies Data Model

**Status:** ⬜ Not started  
**Depends on:** Phase 1 complete

**Goal:** The database schema supports multiple companies with fully isolated data. All existing data is migrated to "Company 1". No API or frontend changes that affect the logged-in user experience yet — the existing single-company flow still works.

### What changes

#### New models

**`backend/app/models/company.py`** — new model:
```python
class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, server_default="SGD")
    financial_year_end: Mapped[str] = mapped_column(String(5), nullable=False, server_default="12-31")
    current_period: Mapped[str] = mapped_column(String(10), nullable=True)
    locked_before: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
```

This replaces the flat `setup` key-value store for company config.

**`backend/app/models/user_company_access.py`** — new junction model:
```python
class UserCompanyAccess(Base):
    __tablename__ = "user_company_access"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    access_level: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
```

Access levels mean the same thing as before (1/3/6) but are now per-company instead of global.

#### Modified models — add `company_id` FK

Every data table gains a `company_id` column referencing `companies.id`:

| Model file | Column to add |
|---|---|
| `models/account.py` | `company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)` |
| `models/ledger.py` | same |
| `models/phrase.py` | same |
| `models/reconciliation.py` (BankRow) | same |
| `models/audit.py` (AuditLog) | same |

The `accounts` table primary key is currently `code` (4-char string). With multi-company, the same code can exist in two companies. Change the PK to a composite: `(company_id, code)`. All FKs from `ledger.account` → `accounts.code` must become `(company_id, code)` compound FKs.

> **Note on accounts PK change:** This is the trickiest migration step. SQLite does not support `ALTER COLUMN`, so the migration must: create new `accounts_new` table with composite PK, copy data, drop old table, rename. Alembic batch mode handles this (`with op.batch_alter_table(...)`).

#### Alembic migration

New migration file. Operations in order:
1. Create `companies` table
2. Insert Company 1: read values from existing `setup` rows (`company_name`, `currency`, etc.) and insert as the first company
3. Create `user_company_access` table
4. Insert one row per existing user into `user_company_access` with `company_id=1` and their current `access_level`
5. Add `company_id INTEGER NOT NULL DEFAULT 1` to `accounts`, `ledger`, `phrases`, `bank_rows`, `audit_log`
6. Migrate `accounts` table to composite PK `(company_id, code)` using batch mode
7. Update `ledger.account` FK to reference `(accounts.company_id, accounts.code)`
8. The old `setup` table can be left in place (it becomes unused after Phase 3)
9. Drop `users.access_level` column (it is superseded by `user_company_access.access_level`)

#### New backend routers (admin-only, system admin gate)

**`backend/app/routers/companies.py`**:
- `GET /companies` — list all companies (system admin) or list companies the current user has access to (regular user)
- `POST /companies` — create a company (`SystemAdmin` only)
- `GET /companies/{id}` — get company details
- `PUT /companies/{id}` — update company config (`SystemAdmin` or company-level admin)
- `DELETE /companies/{id}` — deactivate a company (`SystemAdmin` only)
- `GET /companies/{id}/users` — list users with access to this company (`SystemAdmin`)
- `POST /companies/{id}/users` — assign a user to a company with access level (`SystemAdmin`)
- `PUT /companies/{id}/users/{user_id}` — change access level (`SystemAdmin`)
- `DELETE /companies/{id}/users/{user_id}` — remove user access (`SystemAdmin`)

Register in `backend/app/main.py`:
```python
from app.routers import companies
app.include_router(companies.router)
```

#### Schemas

**`backend/app/schemas/company.py`**:
- `CompanyCreate` — name, currency, financial_year_end
- `CompanyRead` — all fields + id
- `CompanyUpdate` — all fields optional
- `UserCompanyAccessRead` — user_id, username, access_level
- `AssignUserBody` — user_id, access_level

### Acceptance criteria
- [ ] Migration runs cleanly on existing `glpack.db`; all existing data preserved under `company_id = 1`
- [ ] `companies` table exists with one row (the existing company)
- [ ] `user_company_access` table has one row per existing user, all for company 1
- [ ] All data tables (`accounts`, `ledger`, `phrases`, `bank_rows`, `audit_log`) have `company_id = 1` on every row
- [ ] `GET /companies` returns the list for system admin
- [ ] `POST /companies` creates a new company
- [ ] `POST /companies/{id}/users` assigns a user to a company
- [ ] Existing login and all existing pages still work (data still scoped to company 1 implicitly)

---

## Phase 3 — Company-Scoped API

**Status:** ✅ Complete  
**Depends on:** Phase 2 complete

**Goal:** Every API request is automatically scoped to a specific company. A user's JWT includes which company they are working in. Data from one company is never accessible in another company's session.

### What changes

#### Auth flow changes

**Login** (`POST /auth/login`) remains unchanged — it still just validates credentials and returns a token. The token at this stage contains only `user_id` (no company yet).

**New endpoint: `GET /auth/companies`**
- Requires valid JWT (any user)
- Returns list of `{id, name, currency, access_level}` for companies the user has access to
- Pulls from `user_company_access` joined to `companies`

**New endpoint: `POST /auth/select-company`** body: `{company_id: int}`
- Requires valid JWT
- Validates that the user has access to `company_id` in `user_company_access`
- Returns a **new JWT** that includes `company_id` in the payload:
  ```json
  {"sub": "3", "company_id": 1, "jti": "...", "exp": ...}
  ```
- The old token remains valid until expiry (acceptable — or revoke it by adding its JTI to `token_deny`)

**`backend/app/auth.py`** — update `create_token`:
```python
def create_token(user_id: int, company_id: int | None = None) -> tuple[str, str]:
    payload = {"sub": str(user_id), "jti": jti, "exp": expire}
    if company_id is not None:
        payload["company_id"] = company_id
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM), jti
```

Add a new dependency `get_current_company`:
```python
def get_current_company(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> tuple[User, int]:
    """Returns (user, company_id). Raises 401 if token has no company_id."""
    user = get_current_user(token, db)  # existing check
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    company_id = payload.get("company_id")
    if not company_id:
        raise HTTPException(401, "No company selected. Call /auth/select-company first.")
    # Verify access still exists (not revoked after token issued)
    access = db.query(UserCompanyAccess).filter_by(
        user_id=user.id, company_id=company_id
    ).first()
    if not access:
        raise HTTPException(403, "No access to this company")
    return user, company_id
```

Add access-level shorthands that carry company context:
```python
CompanyUser    = Annotated[tuple[User, int], Depends(get_current_company)]
CompanyWrite   = Annotated[tuple[User, int], Depends(require_company_level(3))]
CompanyAdmin   = Annotated[tuple[User, int], Depends(require_company_level(6))]
```

#### Router changes

Every existing router that touches company-scoped data is updated to use `CompanyUser`/`CompanyWrite`/`CompanyAdmin` instead of `CurrentUser`/`WriteAccess`/`AdminAccess`.

Each endpoint destructures `(user, company_id)` from the dependency and adds `company_id` to all queries:

```python
# Before
@router.get("")
def list_accounts(user: CurrentUser, db: Session = Depends(get_db)):
    return db.query(Account).all()

# After
@router.get("")
def list_accounts(ctx: CompanyUser, db: Session = Depends(get_db)):
    user, company_id = ctx
    return db.query(Account).filter(Account.company_id == company_id).all()
```

Routers to update: `accounts`, `journal`, `ledger`, `phrases`, `reports`, `period`, `reconciliation`, `search`, `setup`.

The `setup` router is replaced entirely by reading/writing from the `companies` table instead of the old key-value `setup` table.

The `users` router (system admin) keeps `SystemAdmin` — it is not company-scoped.

#### `setup` router retirement

The existing `GET /setup` and `PUT /setup` endpoints currently read/write the key-value `setup` table. After this phase they should read/write the `companies` row instead:
- `GET /setup` → reads from `companies` where `id = company_id` from token
- `PUT /setup` → updates the `companies` row (requires `CompanyAdmin`)

The old `setup` table can be dropped in this phase's migration or left inert.

### Acceptance criteria
- [x] `GET /auth/companies` returns the correct list for each user
- [x] `POST /auth/select-company` returns a JWT with `company_id` in payload
- [x] `GET /accounts` with a company-scoped token returns only that company's accounts
- [x] Creating a ledger entry or account in Company A is not visible when logged into Company B
- [x] A token without `company_id` gets 401 on all data endpoints
- [x] `GET /setup` returns the `companies` row fields (not key-value store)
- [x] `PUT /setup` updates the `companies` row
- [ ] All existing tests pass (or are updated to include company context)

---

## Phase 4 — Frontend Multi-Company Flow

**Status:** ✅ Complete  
**Depends on:** Phase 3 complete

**Goal:** The frontend handles the full multi-company login flow, lets users work within a selected company, and gives the system admin a complete management UI.

### What changes

#### Auth context

**`frontend/src/context/AuthContext.tsx`** — expand state:
```typescript
interface AuthState {
  user: UserMe | null        // from GET /auth/me (user-level token)
  company: CompanyInfo | null // {id, name, currency, access_level} — set after company selection
  token: string | null       // current JWT (either pre- or post-company-selection)
}
```

Add `selectCompany(companyId: number)` action:
1. Calls `POST /auth/select-company`
2. Stores the new company-scoped token in localStorage
3. Sets `company` in context
4. Navigates to `/dashboard`

Add `clearCompany()` action — reverts to user-level token, navigates to `/companies`.

#### New page: Company Selector (`frontend/src/pages/CompanySelect.tsx`)

Shown after login if the user has access to at least one company. If the user only has one company, auto-select and skip this screen.

- Fetches `GET /auth/companies`
- Displays a card per company: name, currency, their access level
- Clicking a card calls `selectCompany(id)`
- If the user has no companies: show "Contact your administrator to get access to a company."

#### New page: Company Onboarding (`frontend/src/pages/CompanyOnboarding.tsx`)

Shown the first time a user enters a company that has no accounts and no ledger entries. Guides them through:
1. Confirm/edit company name, currency, financial year end
2. Option to import from DBF files (existing seed flow) or start fresh
3. On completion → navigate to `/dashboard`

This page is optional in Phase 4 — implement as a simple form that calls `PUT /setup` and redirects.

#### Login flow update (`frontend/src/pages/Login.tsx`)

After successful login:
- Call `GET /auth/companies`
- If 1 company → auto-select and go to dashboard
- If >1 companies → navigate to `/companies`
- If 0 companies → stay on a "no access" message screen

#### Company switcher in nav

**`frontend/src/components/Layout.tsx`** — add company name display + "Switch company" button in the sidebar header. Clicking "Switch company" calls `clearCompany()` and navigates to `/companies`.

#### Admin page expansion

**`frontend/src/pages/Admin.tsx`** — add a second tab: "Companies" alongside the existing "Users" tab.

Companies tab:
- List all companies: id, name, currency, active/inactive, action buttons
- "New company" form: name, currency, financial year end
- Per-company: "Manage users" button → opens a panel showing users with access and their level; "Add user" dropdown (all users) + access level selector; remove button per user
- Deactivate / Reactivate company toggle

New API client file: **`frontend/src/api/companies.ts`**:
```typescript
getCompanies()            // GET /companies
createCompany(body)       // POST /companies
updateCompany(id, body)   // PUT /companies/{id}
deactivateCompany(id)     // DELETE /companies/{id}
getCompanyUsers(id)       // GET /companies/{id}/users
assignUser(id, body)      // POST /companies/{id}/users
updateUserAccess(id, uid, body)   // PUT /companies/{id}/users/{uid}
removeUser(id, uid)       // DELETE /companies/{id}/users/{uid}
```

#### Routing updates (`frontend/src/App.tsx`)

```
/login           → Login (no auth required)
/companies       → CompanySelect (requires user-level auth, no company yet)
/                → requires company-scoped auth
  /dashboard
  /accounts
  /journal
  /ledger
  /phrases
  /reports
  /reconciliation
  /settings
  /admin         → requires is_system_admin
/404             → NotFound
```

`ProtectedRoute` needs two variants:
- `<AuthRequired>` — requires any valid JWT
- `<CompanyRequired>` — requires JWT with `company_id`

#### SetupContext update

**`frontend/src/context/SetupContext.tsx`** — reads company info from `AuthContext.company` instead of calling `GET /setup` on every load. The `GET /setup` call is still made to get `current_period` and `locked_before` which are not in the JWT.

### Acceptance criteria
- [ ] Admin logs in → goes directly to dashboard (auto-selects their company)
- [ ] A user with 2 companies sees the company selector after login
- [ ] A user with 0 companies sees a "no access" message
- [ ] Switching companies updates all data views to the new company
- [ ] Admin page "Companies" tab: can create a company, assign a user to it, remove a user
- [ ] Company name and currency appear in nav sidebar
- [ ] All existing pages (dashboard, journal, ledger, etc.) work as before within a company context

---

## Phase 5 — Production Hosting

**Status:** ✅ Complete  
**Depends on:** Phase 4 complete

**Goal:** The app runs on a public URL with a production-grade database, can handle multiple concurrent users, and can be deployed in one command.

### What changes

#### Database: SQLite → PostgreSQL

**`backend/app/database.py`** — change to use `DATABASE_URL` from environment:
```python
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./glpack.db")
engine = create_engine(DATABASE_URL)
# Remove check_same_thread arg (SQLite-only)
```

**`backend/.env.example`** — update:
```
DATABASE_URL=postgresql://glpack:password@localhost:5432/glpack
SECRET_KEY=change-me-to-a-long-random-string
ALLOWED_ORIGINS=https://yourdomain.com
```

**`backend/app/main.py`** — load `ALLOWED_ORIGINS` from env:
```python
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
```

**`pyproject.toml`** — add `psycopg2-binary` or `asyncpg` to dependencies.

All Alembic migrations must be re-verified for PostgreSQL compatibility (batch mode is SQLite-only — remove batch wrappers added in Phase 2 and use standard `op.add_column` etc.)

#### Docker Compose

New file: **`docker-compose.yml`** at project root:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: glpack
      POSTGRES_USER: glpack
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    depends_on: [db]
    environment:
      DATABASE_URL: postgresql://glpack:${DB_PASSWORD}@db:5432/glpack
      SECRET_KEY: ${SECRET_KEY}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    ports:
      - "3000:80"

volumes:
  pgdata:
```

New file: **`backend/Dockerfile`**:
```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --no-dev
COPY . .
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

New file: **`frontend/Dockerfile`**:
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

New file: **`frontend/nginx.conf`** — serve SPA with fallback to `index.html`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Security hardening

**Rate limiting on auth endpoints** — add `slowapi` (FastAPI rate limiter):
- `POST /auth/login`: 10 requests / minute per IP

**Token expiry** — reduce from 8 hours to 24 hours for hosted use; make configurable via `TOKEN_EXPIRE_HOURS` env var.

**Password requirements** — add minimum length (8 chars) validation in `UserCreate` schema.

**HTTPS** — handled by the hosting platform (Render/Railway auto-provision TLS). If self-hosting, add a Caddy or Nginx reverse proxy container.

#### Deployment target

Recommended: **Render.com** (free tier available, managed PostgreSQL add-on)

Steps:
1. Push repo to GitHub
2. Create Render PostgreSQL database → copy connection string
3. Create Render Web Service (backend) → set env vars
4. Create Render Static Site (frontend) → set `VITE_API_URL` build var
5. Run migrations: `uv run alembic upgrade head`
6. Run seed (admin user only): `uv run python -m seed.seed_users`

Alternative: **Railway**, **Fly.io**, or a VPS with Docker Compose.

### Acceptance criteria
- [ ] `docker-compose up` starts the full stack (db + backend + frontend)
- [ ] `docker-compose up` on a fresh machine with no prior data runs migrations and works
- [ ] Backend connects to PostgreSQL (verify via `GET /health`)
- [ ] All Phase 1–4 features work against PostgreSQL
- [ ] Login rate limiting rejects >10 failed attempts/minute from same IP
- [ ] `ALLOWED_ORIGINS` env var controls CORS (not hardcoded localhost)
- [ ] Frontend served from nginx with SPA fallback routing working
- [ ] App accessible at a public URL with HTTPS

---

## Implementation Notes

### Running the app locally (current)
```bash
# Backend
cd backend
uv run alembic upgrade head
uv run python -m seed.seed_all   # or individual seed files
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Running migrations
```bash
cd backend
uv run alembic upgrade head                          # apply all
uv run alembic revision --autogenerate -m "message"  # generate new migration
uv run alembic downgrade -1                          # roll back one
```

### Testing
```bash
cd backend
uv run pytest
```

### Key conventions
- All monetary amounts: `Numeric(12, 2)` in DB, `Decimal` in Python, string in JSON
- Dates: ISO 8601 strings (`YYYY-MM-DD`) everywhere
- Account codes: 4-character strings (padded)
- Transaction numbers (`trx_no`): 4-character strings
- Access levels: integers 1, 3, 6 — never use string names in code
- Pydantic schemas: `*Create` for POST body, `*Read` for response, `*Update` for PUT body (all fields optional)
- All mutations return the updated object (not just 200 OK)
- Soft-delete pattern for users and companies (set `is_active = False`, never hard delete)

### Accounts table composite PK note (Phase 2)
The `accounts.code` column is currently the sole PK. After adding `company_id`, the PK becomes `(company_id, code)`. The `ledger.account` FK (currently `→ accounts.code`) must become a compound FK `(company_id, account) → (accounts.company_id, accounts.code)`. SQLAlchemy supports this via `ForeignKeyConstraint`. This is the most complex migration step — test it carefully on a copy of the database before running on production.

---

## Session Handoff Checklist

When starting a new session on this project:

1. Read this document (`HOSTED_BUILD_PLAN.md`) fully
2. Check which phases are marked `[x]` complete in the Phase Checklist above
3. Read the acceptance criteria for the current phase — any unchecked items are outstanding work
4. Run `git log --oneline -10` to see what was committed in the last session
5. Run the backend and verify `GET /health` responds before making schema changes
6. If a migration exists but has not been run: `cd backend && uv run alembic upgrade head`
7. Begin work at the first unchecked acceptance criterion

When completing a phase, mark its checkbox in this document and commit the update.
