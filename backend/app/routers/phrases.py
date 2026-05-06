from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import CompanyUser, CompanyWrite
from app.database import get_db
from app.models.phrase import Phrase
from app.schemas.phrase import PhraseCreate, PhraseRead

router = APIRouter(prefix="/phrases", tags=["phrases"])


@router.get("", response_model=list[PhraseRead])
def list_phrases(ctx: CompanyUser, search: str | None = Query(None), db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    q = db.query(Phrase).filter(Phrase.company_id == company_id)
    if search:
        q = q.filter(Phrase.phrase.ilike(f"%{search}%"))
    return q.order_by(Phrase.phrase).all()


@router.post("", response_model=PhraseRead, status_code=201)
def create_phrase(body: PhraseCreate, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    phrase = Phrase(company_id=company_id, phrase=body.phrase, dr_code=body.dr_code, cr_code=body.cr_code)
    db.add(phrase)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate phrase/code combination")
    db.refresh(phrase)
    return phrase


@router.delete("/{phrase_id}", status_code=204)
def delete_phrase(phrase_id: int, ctx: CompanyWrite, db: Session = Depends(get_db)):
    _, company_id, _ = ctx
    phrase = db.get(Phrase, phrase_id)
    if not phrase or phrase.company_id != company_id:
        raise HTTPException(status_code=404, detail="Phrase not found")
    db.delete(phrase)
    db.commit()
