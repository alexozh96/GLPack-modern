from dotenv import load_dotenv
load_dotenv()  # must run before any module reads os.getenv()

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.routers import (
    accounts, auth, companies, journal, ledger,
    period, phrases, reconciliation, reports, search, setup, users,
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: purge expired token deny entries to keep the table bounded
    from app.database import SessionLocal
    from app.models.token_deny import TokenDeny
    db = SessionLocal()
    try:
        db.query(TokenDeny).filter(
            TokenDeny.expires_at.isnot(None),
            TokenDeny.expires_at < datetime.now(timezone.utc),
        ).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
    yield


app = FastAPI(title="GLPack Modern", version="0.1.0", lifespan=lifespan)

_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(accounts.router)
app.include_router(setup.router)
app.include_router(phrases.router)
app.include_router(journal.router)
app.include_router(ledger.router)
app.include_router(reports.router)
app.include_router(period.router)
app.include_router(reconciliation.router)
app.include_router(search.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "GLPack Modern"}
