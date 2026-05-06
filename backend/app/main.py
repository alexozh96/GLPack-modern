import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    accounts, auth, companies, journal, ledger,
    period, phrases, reconciliation, reports, search, setup, users,
)

app = FastAPI(title="GLPack Modern", version="0.1.0")

_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
