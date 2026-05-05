"""Import ACCLIST.DBF → accounts table (516 records expected)."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
from dbfread import DBF
from app.database import SessionLocal
from app.models.account import Account

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DBF_PATH = Path(os.environ["GLPACK_DATA_DIR"]) / "ACCLIST.DBF"


def seed_accounts(session=None) -> int:
    own_session = session is None
    if own_session:
        session = SessionLocal()
    try:
        table = DBF(str(DBF_PATH), encoding="cp437", load=True)
        count = 0
        for record in table:
            code = (record.get("CODE") or "").strip()
            name = (record.get("ACCNAME") or "").strip()
            if not code:
                continue
            session.merge(Account(code=code, name=name))
            count += 1
        if own_session:
            session.commit()
        return count
    finally:
        if own_session:
            session.close()


if __name__ == "__main__":
    n = seed_accounts()
    print(f"Seeded {n} accounts (expected 516)")
