from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.account import Account
from app.models.ledger import LedgerEntry
from app.models.phrase import Phrase
from app.schemas.search import AccountResult, JournalResult, PhraseResult, SearchResult

router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=SearchResult)
def search(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(8, le=20),
    db: Session = Depends(get_db),
):
    pattern = f"%{q}%"

    accounts = (
        db.query(Account)
        .filter(or_(Account.code.ilike(pattern), Account.name.ilike(pattern)))
        .order_by(Account.code)
        .limit(limit)
        .all()
    )

    phrases = (
        db.query(Phrase)
        .filter(Phrase.phrase.ilike(pattern))
        .order_by(Phrase.phrase)
        .limit(limit)
        .all()
    )

    journal_rows = (
        db.query(
            LedgerEntry.trx_no,
            LedgerEntry.date,
            func.min(LedgerEntry.particular).label("description"),
        )
        .filter(LedgerEntry.particular.ilike(pattern))
        .group_by(LedgerEntry.trx_no, LedgerEntry.date)
        .order_by(LedgerEntry.date.desc(), LedgerEntry.trx_no)
        .limit(limit)
        .all()
    )

    return SearchResult(
        accounts=[AccountResult(code=a.code, name=a.name) for a in accounts],
        phrases=[PhraseResult(id=p.id, phrase=p.phrase, dr_code=p.dr_code, cr_code=p.cr_code) for p in phrases],
        journal_entries=[
            JournalResult(trx_no=r.trx_no, date=r.date, description=r.description)
            for r in journal_rows
        ],
    )
