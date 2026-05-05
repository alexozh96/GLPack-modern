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


def seed_accounts(session=None) -> int:
    data_dir = os.environ.get("GLPACK_DATA_DIR")
    if not data_dir:
        raise EnvironmentError("GLPACK_DATA_DIR is not set in backend/.env")
    dbf_path = Path(data_dir) / "ACCLIST.DBF"
    own_session = session is None
    if own_session:
        session = SessionLocal()
    try:
        table = DBF(str(dbf_path), encoding="cp437", load=True)
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
