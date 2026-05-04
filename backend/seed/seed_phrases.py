"""Import GLPHRASE.DBF → phrases table (1794 records expected, ~1788 unique combos)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dbfread import DBF
from app.database import SessionLocal
from app.models.phrase import Phrase

DBF_PATH = Path(r"C:\Users\Alex\OneDrive\Documents\GLPACK\GLPHRASE.DBF")


def seed_phrases(session=None) -> int:
    own_session = session is None
    if own_session:
        session = SessionLocal()
    try:
        table = DBF(str(DBF_PATH), encoding="cp437", load=True)

        seen: set[tuple] = {
            (p.phrase, p.dr_code, p.cr_code)
            for p in session.query(Phrase).all()
        }
        count = 0
        for record in table:
            phrase = (record.get("PHRASE") or "").strip()
            dr_code = (record.get("DRCODE") or "").strip() or None
            cr_code = (record.get("CRCODE") or "").strip() or None
            if not phrase:
                continue
            key = (phrase, dr_code, cr_code)
            if key in seen:
                continue
            seen.add(key)
            session.add(Phrase(phrase=phrase[:45], dr_code=dr_code, cr_code=cr_code))
            count += 1
        if own_session:
            session.commit()
        return count
    finally:
        if own_session:
            session.close()


if __name__ == "__main__":
    n = seed_phrases()
    print(f"Seeded {n} phrases (~1788 unique expected)")
