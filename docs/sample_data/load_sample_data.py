"""
Load Apex Consulting Pte Ltd sample data into a running GLPack instance.

Usage:
    python load_sample_data.py [--url http://localhost:8000] [--user admin] [--password admin123]

Run the backend first (start.bat or uvicorn), then run this script.
It imports accounts then journal entries in the correct order.
"""

import argparse
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' is not installed. Run: pip install requests")
    sys.exit(1)

HERE = Path(__file__).parent


def login(base_url: str, username: str, password: str) -> str:
    resp = requests.post(
        f"{base_url}/auth/login",
        data={"username": username, "password": password},
        timeout=10,
    )
    if resp.status_code != 200:
        print(f"Login failed ({resp.status_code}): {resp.text}")
        sys.exit(1)
    token = resp.json().get("access_token")
    print(f"Logged in as '{username}'")
    return token


def import_accounts(base_url: str, headers: dict, csv_path: Path) -> None:
    print(f"\nImporting accounts from {csv_path.name}...")
    with open(csv_path, "rb") as f:
        resp = requests.post(
            f"{base_url}/accounts/import-csv",
            files={"file": (csv_path.name, f, "text/csv")},
            headers=headers,
            timeout=30,
        )
    if resp.status_code == 200:
        data = resp.json()
        print(f"  Accounts: {data['imported']} imported, {data['skipped']} skipped")
    else:
        print(f"  ERROR ({resp.status_code}): {resp.text}")
        sys.exit(1)


def import_journal(base_url: str, headers: dict, csv_path: Path) -> None:
    print(f"\nImporting journal entries from {csv_path.name}...")
    with open(csv_path, "rb") as f:
        resp = requests.post(
            f"{base_url}/ledger/import-csv",
            files={"file": (csv_path.name, f, "text/csv")},
            headers=headers,
            timeout=60,
        )
    if resp.status_code == 200:
        data = resp.json()
        print(f"  Ledger: {data['imported_rows']} rows, {data['imported_transactions']} transactions imported")
    else:
        detail = resp.json().get("detail", resp.text) if resp.headers.get("content-type", "").startswith("application/json") else resp.text
        if isinstance(detail, list):
            print(f"  ERROR ({resp.status_code}):")
            for line in detail:
                print(f"    {line}")
        else:
            print(f"  ERROR ({resp.status_code}): {detail}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Load GLPack sample data")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--user", default="admin", help="Admin username")
    parser.add_argument("--password", default="admin123", help="Admin password")
    args = parser.parse_args()

    base = args.url.rstrip("/")

    token = login(base, args.user, args.password)
    auth_headers = {"Authorization": f"Bearer {token}"}

    import_accounts(base, auth_headers, HERE / "accounts_sample.csv")
    import_journal(base, auth_headers, HERE / "journal_entries_sample.csv")

    print("\nSample data loaded successfully.")
    print("Company: Apex Consulting Pte Ltd")
    print("Period:  Jan–Mar 2025")
    print("\nFor bank reconciliation, upload bank_statement_sample.csv")
    print("via the Bank Reconciliation page → Import Statement (account: CB01).")


if __name__ == "__main__":
    main()
