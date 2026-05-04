"""Run all seed scripts in dependency order."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from seed.seed_accounts import seed_accounts
from seed.seed_phrases import seed_phrases
from seed.seed_ledger import seed_ledger
from seed.seed_setup import seed_setup
from seed.seed_users import seed_users


def main():
    session = SessionLocal()
    try:
        print("Seeding accounts...", end=" ", flush=True)
        n = seed_accounts(session)
        session.commit()
        print(f"{n} rows")

        print("Seeding phrases...", end=" ", flush=True)
        n = seed_phrases(session)
        session.commit()
        print(f"{n} rows")

        print("Seeding ledger...", end=" ", flush=True)
        n = seed_ledger(session)
        session.commit()
        print(f"{n} rows")

        print("Seeding setup...", end=" ", flush=True)
        n = seed_setup(session)
        session.commit()
        print(f"{n} rows")

        print("Seeding users...", end=" ", flush=True)
        n = seed_users(session)
        session.commit()
        print(f"{n} rows")

        print("\nAll seeds complete.")
    except Exception as exc:
        session.rollback()
        print(f"\nSeed failed: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
