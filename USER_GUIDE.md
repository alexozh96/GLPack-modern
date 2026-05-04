# GLPack Modern — User Guide

This guide explains how to use GLPack Modern from scratch. No accounting software or technical experience is assumed.

---

## What is GLPack Modern?

GLPack Modern is a **general ledger accounting system** — the same kind of software used by accountants and bookkeepers to record every financial transaction a business makes.

Think of it as a digital record book. Every time money moves in or out of the business — a sale, an expense, a bank transfer — you record it here. The system then automatically produces financial reports: profit & loss, balance sheet, trial balance, and more.

---

## Getting Started

### Opening the application

1. Make sure the **backend** (the server) is running. You will need a terminal to start it:
   ```
   cd backend
   uv run uvicorn app.main:app --reload
   ```
2. Make sure the **frontend** (the web app) is running. Open a second terminal:
   ```
   cd frontend
   npm run dev
   ```
3. Open your browser and go to **http://localhost:5173**

You will see the **login page**.

### Logging in

Enter your username and password and click **Sign In**.

- The default administrator account is `admin` / `admin123`. Change this password after your first login.
- If you type the wrong password, you will see an error message. Try again.
- After 8 hours of inactivity your session expires automatically and you will be sent back to the login page.

---

## The Main Screen

Once logged in, you will see a **sidebar on the left** with the main sections of the app, and the current page on the right.

The sections are:

| Section | What it does |
|---|---|
| **Dashboard** | A quick overview of financial performance |
| **Journal** | Where you record transactions |
| **Ledger** | View the transaction history for any account |
| **Accounts** | Manage the chart of accounts |
| **Reports** | Generate financial statements |
| **Bank Reconciliation** | Match bank statement lines to GL entries |
| **Settings** | Company setup, period close, and phrases |

At the top of the screen there is a **search bar** (or press **Ctrl+K**) that lets you search across all accounts, phrases, and journal entries at once.

---

## Concepts to Know First

Before using the app, it helps to understand a few basic ideas.

### Accounts

An **account** is a named bucket that holds a running total. Examples:
- `CB01 — CASH AT BANK` holds your bank balance
- `SA01 — SALES` holds your revenue from sales
- `EX10 — RENT` holds how much you've spent on rent

Every account has a short **code** (like `CB01`) and a longer **name**. You always refer to accounts by their code.

Accounts are grouped into types. The most important distinction:
- **Balance Sheet accounts** (assets, liabilities, equity) carry their balance forward forever.
- **P&L accounts** (sales `SA*`, cost of sales `CO*`, expenses `EX*`, tax `TX*`, other income `OI*`) are zeroed out when you close a financial period.

### Double-Entry Bookkeeping

Every transaction must **balance** — every pound/dollar that comes from somewhere must go somewhere. This is enforced automatically.

When you record a transaction you enter **lines**, and every line has either a **Dr (Debit)** amount or a **Cr (Credit)** amount. The total of all Dr amounts must equal the total of all Cr amounts before you can save.

You do not need to memorise which accounts are debited or credited — the **Phrases** feature (see Settings) stores your common transaction patterns so you can fill them in with one click.

### Transaction Number (Trx No)

Every transaction has a unique reference number you assign yourself, such as `0001`, `INV-2024-01`, or `WAGES-JAN`. This is how you find and edit a transaction later.

---

## Dashboard

The Dashboard shows you:

- **Revenue** for the current calendar year so far
- **Gross profit margin** as a percentage
- **Net profit** for the year
- **Number of journal entries** recorded
- A **recent transactions** list you can click to open any entry in the Journal

This page is read-only — it is for monitoring, not data entry.

---

## Journal

The Journal is where you **record transactions**. This is the most important part of the system.

### Viewing existing transactions

The left panel lists all transactions. Click any row to open its detail on the right.

You can search within the list using the search box at the top of the left panel.

### Creating a new transaction

1. Click **New Entry** (top-right of the Journal page).
2. Enter a **Transaction No** — any unique reference you choose, e.g. `INV-001`. You cannot save two transactions with the same number.
3. Enter the **Date** of the transaction.
4. You will see a table of lines. Each line needs:
   - **Account** — type the account code or name; a dropdown will appear to help you pick.
   - **Particular** — a short description of this line, e.g. `Cash sale` or `Office rent Jan`.
   - **Dr** or **Cr** — the amount. Enter it in whichever column applies.
5. Add more lines using the **+ Add line** button.
6. The **Balance** indicator at the bottom shows whether Dr = Cr. It must show **Balanced** before you can save.
7. Click **Save**.

**Tip:** Use the **Phrase** dropdown (if your journal has one) to auto-fill the account code and description from a saved phrase.

### Editing a transaction

Click a transaction in the list to open it. Make your changes, then click **Save**.

> Transactions dated on or before the **period close date** are locked and cannot be edited. A warning will tell you if you try.

### Deleting a transaction

Open the transaction and click **Delete**. You will be asked to confirm. Locked transactions cannot be deleted.

---

## Ledger

The Ledger lets you view the full transaction history for **one specific account** over a date range.

1. Choose an **Account** from the dropdown.
2. Enter a **From** and **To** date.
3. Click **View** (or press Enter).

You will see each transaction line that touched that account, with running Dr and Cr columns, and a **Balance** column that updates after each row.

Click **Download PDF** to export the ledger to a PDF file.

Click any transaction row to jump directly to that entry in the Journal.

---

## Accounts

This page shows the full **Chart of Accounts** — the complete list of all accounts in the system.

### Viewing accounts

The list shows each account's code and name. Use the search box to filter. Click any account to select it and see its current balance.

### Adding an account (Admin only)

1. Click **New Account**.
2. Enter the **Code** (e.g. `EX99`) and **Name** (e.g. `Miscellaneous Expense`).
3. Click **Save**.

Account codes determine how they appear in reports. Follow the convention already in use (e.g. `CB` for cash/bank, `SA` for sales, `EX` for expenses).

### Editing or deleting an account (Admin only)

Click the account in the list to select it, then use the **Edit** or **Delete** button. You cannot delete an account that has transactions recorded against it.

---

## Reports

The Reports page generates financial statements for any period you choose.

### How to run a report

1. Click the report name in the left panel.
2. Enter the required dates (period start and end, or an as-of date).
3. Click **Run**.

The report appears on the right. Most reports have a **Download PDF** button.

### Available reports

**Trial Balance**
A two-column list of every account with its total debits and total credits for the period. The totals must balance. Use this to check the books are correct.

**Profit & Loss (Income Statement)**
Shows Revenue minus Expenses to arrive at Net Profit. Broken into:
- Sales revenue
- Cost of sales → Gross Profit
- Other income
- Operating expenses → Profit Before Tax
- Taxation → Profit After Tax
- Retained profit carried forward

**Balance Sheet**
A snapshot of what the business owns (assets) and owes (liabilities + equity) at a point in time. Total assets must equal total liabilities + equity.

**Expense Schedule**
A detailed breakdown of all expense account balances for the period. Useful for reviewing where money was spent.

**Debtors Listing**
Balances owed to the business (accounts starting with `TD*` or similar debtor codes).

**Creditors Listing**
Balances owed by the business to suppliers (accounts starting with `TC*` or similar creditor codes).

**Fixed Assets**
Balances of fixed asset accounts (e.g. `FA*`).

**Full Financial Statements (PDF)**
Exports all reports into a single PDF document.

---

## Bank Reconciliation

Bank reconciliation is the process of **matching your bank statement to your GL** — confirming that every line on your bank statement has a corresponding entry in the accounting records.

### Step 1 — Import your bank statement

1. Download your bank statement as a **CSV file** from your internet banking portal.
2. On the Bank Reconciliation page, click **Import CSV**.
3. Select your CSV file. The file must have columns: `date`, `description`, `amount`.
4. The bank rows appear in the left panel under **Unmatched Bank Lines**.

### Step 2 — Match lines

The right panel shows **Unmatched GL Cash Entries** — journal entries posted to your cash/bank accounts (codes starting with `CB*`) that have not yet been matched.

- Click a bank row on the left to select it (it highlights in amber).
- Click the matching GL entry on the right.
- Click **Match Selected**. The pair disappears from both unmatched lists.

### Step 3 — Review matched pairs

Click the **Matched** tab to see all confirmed matches. To undo a match, click **Unmatch** next to any pair.

### Summary bar

At the top of the page a summary shows Total / Matched / Unmatched bank rows. When Unmatched reaches zero, your bank is fully reconciled for that import.

---

## Settings

The Settings page has three sections.

### Company Settings (Admin only)

Set the company name, currency, financial year end, and current period. Click **Save Settings** to apply changes.

### Period Close (Admin only)

Closing a period:
1. **Zeroes out all P&L accounts** — revenue, cost of sales, expenses, and tax accounts are all set to zero by posting a balancing journal entry.
2. **Transfers net profit** to the P&L retained earnings account.
3. **Locks all transactions** dated on or before the close date — they cannot be edited or deleted afterwards.

**How to close a period:**
1. Enter the **Period End Date** (e.g. `2024-12-31`).
2. Click **Close Period**.
3. Read the confirmation dialog carefully — this cannot be undone.
4. Click **Yes, Close Period**.

After closing, the "Currently locked through" date is shown so you know how far back the books are frozen.

### Journal Phrases

Phrases are **shortcuts for common journal entries**. Each phrase stores a description text and, optionally, the default Dr and Cr account codes.

When you type in the Particular field in the Journal, your saved phrases appear as suggestions. Selecting one fills in the account codes automatically, saving time.

**To add a phrase:**
1. Type the phrase text (e.g. `Monthly rent payment`).
2. Optionally enter a Dr Code and Cr Code (e.g. `EX10` and `CB01`).
3. Click **Add**.

**To delete a phrase:** Click **Delete** next to the phrase in the list.

Use the search box to filter the phrase list when it gets long.

---

## User Management (Admin only)

Admins can create, update, and delete users from the **users** endpoint (`/users`). This is currently accessible via the API directly; a UI for user management may be added in a future version.

**Access levels:**
| Level | What they can do |
|---|---|
| 1 | View all data, run reports — read only |
| 3 | Everything level 1 can do, plus create/edit journal entries and phrases |
| 6 | Everything level 3 can do, plus manage accounts, users, setup, and close periods |

---

## Global Search

Press **Ctrl+K** anywhere in the app to open the global search bar.

Type at least 2 characters to search across:
- **Accounts** — by code or name
- **Phrases** — by description
- **Journal entries** — by the particulars text on any line

Click a result to navigate directly to it.

---

## Frequently Asked Questions

**The system says "Not balanced — cannot save." What does that mean?**
Your Dr total and Cr total are not equal. Check each line's amount and column. The imbalance amount is shown — find which line is wrong or missing.

**I can't edit a transaction. It says the entry is locked.**
The transaction date falls on or before the period close date. Locked entries cannot be changed to preserve the integrity of closed financial periods. If you need to correct something, post a new reversing entry on a date after the lock.

**The P&L report shows zero revenue even though I've recorded sales.**
Check that your sales accounts use the correct prefix (`SA*`). The P&L report only picks up accounts in the P&L categories (SA, CO, OI, EX, TX). Also check that your date range covers the transactions you've entered.

**I imported a CSV for bank reconciliation but nothing appeared.**
The CSV must have exactly three columns named `date`, `description`, and `amount`. Dates must be in `YYYY-MM-DD` format. Amounts should be positive for credits, negative for debits (or vice versa depending on your bank's export format).

**How do I change my password?**
Ask your administrator to update it via the user management API.

**I deleted a phrase by mistake. Can I get it back?**
No — phrase deletion is immediate and permanent. Re-create it by entering the same text and account codes in the Add Phrase form.

---

## Quick Reference — Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open global search |
| `Enter` in Phrase search | Search immediately |
| `Enter` in New Phrase field | Add the phrase |
| `Escape` | Close search popup |

---

*GLPack Modern — rebuilt from the original GLPack DBF system.*
