"""Import GLEDGER.DBF → ledger table (181 records expected)."""
import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
from dbfread import DBF
from app.database import SessionLocal
from app.models.ledger import LedgerEntry

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DBF_PATH = Path(os.environ["GLPACK_DATA_DIR"]) / "GLEDGER.DBF"


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value)).quantize(Decimal("0.01"))


_NULL_DATE = date(1924, 1, 1)  # dbfread renders 00000000 as 1924-01-01
_OPENING_BALANCE_DATE = date(2023, 1, 1)  # opening balances roll forward from 2022 year-end


def _to_date(value) -> date:
    """dbfread returns date fields as datetime.date; handle None and null-dates."""
    if value is None:
        return _OPENING_BALANCE_DATE
    if isinstance(value, date):
        # 1924-01-01 = stored as 00000000 (null date) = opening balance entry
        return _OPENING_BALANCE_DATE if value == _NULL_DATE else value
    s = str(value).strip()
    return date(int(s[0:4]), int(s[4:6]), int(s[6:8]))


def seed_ledger(session=None) -> int:
    own_session = session is None
    if own_session:
        session = SessionLocal()
    try:
        table = DBF(str(DBF_PATH), encoding="cp437", load=True)
        count = 0
        for record in table:
            trx_no = (record.get("TRXNO") or "").strip()
            account = (record.get("LEDGERNAME") or "").strip()
            particular = (record.get("PARTICULAR") or "").strip()
            if not trx_no or not account:
                continue
            entry = LedgerEntry(
                date=_to_date(record.get("DATE")),
                trx_no=trx_no,
                account=account,
                particular=particular[:45],
                dr_amount=_to_decimal(record.get("DRAMOUNT")),
                cr_amount=_to_decimal(record.get("CRAMOUNT")),
            )
            session.add(entry)
            count += 1
        if own_session:
            session.commit()
        return count
    finally:
        if own_session:
            session.close()


if __name__ == "__main__":
    n = seed_ledger()
    print(f"Seeded {n} ledger entries (expected 181)")
