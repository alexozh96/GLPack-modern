"""Seed the setup table with company configuration from GLPACK."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.setup import Setup

DEFAULTS = {
    "company_name": "Event Master 2020 PTE LTD",
    "currency": "SGD",
    "financial_year_end": "12-31",
    "current_period": "2022-12-31",
}


def seed_setup(session=None) -> int:
    own_session = session is None
    if own_session:
        session = SessionLocal()
    try:
        for key, value in DEFAULTS.items():
            session.merge(Setup(key=key, value=value))
        if own_session:
            session.commit()
        return len(DEFAULTS)
    finally:
        if own_session:
            session.close()


if __name__ == "__main__":
    n = seed_setup()
    print(f"Seeded {n} setup keys")
