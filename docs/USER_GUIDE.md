# GLPack Modern — User Guide

---

## Table of Contents

1. [What GLPack Modern Is](#1-what-glpack-modern-is)
2. [Basic Concepts](#2-basic-concepts)
3. [Login and Access](#3-login-and-access)
4. [App Navigation](#4-app-navigation)
5. [Dashboard](#5-dashboard)
6. [Journal Entry](#6-journal-entry)
7. [Ledger View](#7-ledger-view)
8. [Chart of Accounts](#8-chart-of-accounts)
9. [Reports](#9-reports)
10. [Bank Reconciliation](#10-bank-reconciliation)
11. [Settings and Period Close](#11-settings-and-period-close)
12. [Global Search](#12-global-search)
13. [User Management (Admin)](#13-user-management-admin)
14. [Typical Workflows](#14-typical-workflows)
15. [Troubleshooting](#15-troubleshooting)
16. [Appendix](#16-appendix)

---

## 1. What GLPack Modern Is

GLPack Modern is a **general ledger accounting system** designed for small businesses. It records financial transactions, produces financial statements, and reconciles bank activity.

**Who it is for:** Bookkeepers, accountants, and business owners who need to maintain an accurate general ledger, produce period-end reports, and track cash movements.

**What it supports:**
- Posting and managing double-entry journal entries
- Viewing account activity in a running ledger
- Generating financial reports: Trial Balance, Profit & Loss, Balance Sheet, Expense Schedule, Debtors Listing, Creditors Listing, Fixed Assets
- Exporting reports and ledger accounts to PDF
- Importing bank statements (CSV) and manually matching them to GL entries
- Period close — locking completed periods and carrying net profit forward
- A phrase library to speed up repetitive journal entry descriptions

**What it does not do:**
- Automatic bank feeds or real-time integration with banking systems
- Invoicing or accounts-receivable tracking beyond the ledger
- Payroll processing
- Multi-currency conversion (currency is a display label only)
- Inventory management

### How it is deployed

GLPack Modern runs **on your own machine** (or a server you control). It is not a cloud service. The data lives in a database file on whatever computer is running the backend. The frontend is just a browser-based interface to that database.

This means:
- **Your data stays on your machine.** Nothing is sent to a third party. You are responsible for backing up the database file.
- **The backend must be running** for anyone to use the app. If you shut down the computer or stop the process, the app is offline until you start it again.
- **Multiple people can use it simultaneously** by connecting to the same backend over a local network — one person runs the backend, others open the frontend URL in their browser.
- **A single-person setup** is simply running both the backend and frontend on the same laptop and opening `http://localhost:5173`.

---

## 2. Basic Concepts

### General Ledger
The master record of every financial transaction in the business. Every debit and credit ever posted lives in the general ledger. GLPack Modern's entire database is a general ledger.

### Chart of Accounts
The list of all accounts used to categorise transactions. Each account has a short code (up to 4 characters) and a name. Accounts are grouped by the first digit of their code:

| First digit | Category |
|------------|----------|
| 1 | Assets |
| 2 | Liabilities |
| 3 | Equity |
| 4 | Revenue (prefix `SA` = Sales, `OI` = Other Income) |
| 5 | Expenses (prefix `EX` = Expenses, `CO` = Cost of Sales, `TX` = Taxation) |

Special prefix conventions used by the system:
- `CB` — Cash/Bank accounts (used for bank reconciliation matching)
- `SA` — Sales/Revenue accounts
- `CO` — Cost of Sales accounts
- `OI` — Other Income accounts
- `EX` — Expense accounts
- `TX` — Taxation accounts
- `PL` — Profit & Loss retained account (created automatically on period close if absent)

### Debit and Credit
Every transaction line is either a **Debit (Dr)** or a **Credit (Cr)**. The accounting rule is:

| Account type | Increases with | Decreases with |
|---|---|---|
| Asset | Debit | Credit |
| Liability | Credit | Debit |
| Equity | Credit | Debit |
| Revenue | Credit | Debit |
| Expense | Debit | Credit |

The golden rule: **every journal entry must have equal total debits and total credits**. If they are not equal, the entry will be rejected.

### Journal Entry
A journal entry is a record of one business event. It has a date, a transaction number (TRX), and two or more lines — each line showing an account code, a description (particular), and either a debit or a credit amount. The app auto-assigns the next sequential TRX number.

### Ledger View
The Ledger page shows all postings for a single account in date order, with a running balance after each line. This is the T-account view for a specific account.

### Trial Balance
A report listing all accounts with their total debits, total credits, and net balance for a period. If the ledger is correct, total debits will equal total credits.

### Profit & Loss (P&L)
A report showing revenues, cost of sales, gross profit, other income, expenses, and net profit for a period. Profit is revenue minus expenses.

### Balance Sheet
A snapshot of the business's financial position at a point in time: equity, current assets, current liabilities, and fixed assets. Also shows net current assets and total net assets.

### Bank Reconciliation
The process of matching transactions in the bank statement (imported from a CSV file) to transactions already posted in the general ledger. The goal is to confirm every bank movement is recorded in the books and vice versa.

### Period Close
Closing a period zeroes out all P&L accounts (Sales, Cost of Sales, Other Income, Expenses, Taxation) by posting a balancing "BALANCE CARRIED DOWN" closing entry, and transfers the net profit to the Profit & Loss retained account (`PL` prefix). All entries on or before the close date are then **locked** — they cannot be edited or deleted.

### Balance Carried Down / Brought Down
These are standard accounting terms for closing entries. "Balance Carried Down" (B/d or c/d) refers to the closing entry that zeroes an account's balance at period end. "Balance Brought Down" (B/d or b/d) refers to the opening balance in the next period. GLPack Modern uses "BALANCE CARRIED DOWN" as the particular text in closing journal lines.

### Particulars / Phrase Templates
A **particular** is the description text on a journal line — it explains what that line represents (e.g. "Cash sale", "Office supplies"). GLPack Modern includes a library of phrase templates (from the imported GLPHRASE database) so common descriptions auto-complete while you type.

### Account Codes
Account codes are 1–4 uppercase characters. They must be added to the Chart of Accounts before they can be used in journal entries. The code prefix determines how the account is classified in reports.

### Dr/Cr Default Codes in Phrase Suggestions
When a phrase template has a Dr Code and/or Cr Code configured, those codes appear in brackets in the autocomplete list: for example `Salary expense [Dr:EX80 Cr:CB02]`. Selecting this phrase does not automatically fill in the account fields — it only fills the description. You still need to type the account codes yourself.

---

## 3. Login and Access

### Login Page
Open the app in your browser. You will see the sign-in form. Enter your **Username** and **Password** and click **Sign in**.

After a successful login, the app stores a session token (valid for 8 hours) and redirects you to the Dashboard. If you leave the app open for more than 8 hours, you will be redirected to the login screen.

### Default Admin Credentials
The seed data creates one default administrator account:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

**Change the admin password immediately after first login.** This is done through the API or by having a developer update it. There is no self-service password change in the current UI — an administrator must update passwords via the User Management API (`PUT /users/{id}`).

### Access Levels
There are three meaningful access levels:

| Level | Name | What they can do |
|-------|------|-----------------|
| 1 | Read Only | View all pages, reports, journal entries, ledger. Cannot create, edit, or delete anything. |
| 3 | Bookkeeper / Entry | Everything at level 1, plus: post new journal entries, edit and delete journal entries in open periods, manage phrase templates, import bank CSV, match/unmatch reconciliation. |
| 6 | Administrator | Everything at level 3, plus: manage the Chart of Accounts, manage user accounts, change system settings (company name, currency, period), close periods. |

Only an Administrator can create, edit, or delete user accounts and change account or system settings.

### What Happens After Login
You are taken to the Dashboard, which shows KPI cards, a monthly transaction chart, quick action buttons, and recent journal entries. The sidebar on the left shows the main navigation. The top bar shows a breadcrumb and the global search box.

### Sessions and Incomplete Work

**Your posted data is always safe.** Anything you submitted with "Post Entry" is written to the database immediately and permanently. Closing the browser, shutting down the computer, or losing power does not affect already-posted entries. When you restart and log back in, everything is exactly as you left it.

**An unsaved form is lost if you close the browser.** If you are halfway through filling in a new journal entry and close the tab or the browser, that draft is gone — it only existed in the browser's memory and was never sent to the database. You will need to re-enter it.

**The session lasts 8 hours.** If you step away and return the next day, you will be asked to log in again. Your data is untouched — only the login session expires.

**The point of login in a local setup** is access control, not security theatre. It enforces who can do what: a read-only user can view everything but cannot post or delete; a bookkeeper can post entries but cannot close periods or change accounts; only an administrator can make structural changes. In a shared environment (multiple staff using the same backend) this prevents accidental or unauthorised changes.

### If Login Fails
The error message "Invalid username or password" appears. Check that you are typing the username and password exactly as configured — usernames are case-sensitive. If you have forgotten your password, an Administrator must reset it.

---

## 4. App Navigation

### Sidebar
The dark sidebar on the left side of the screen is always visible after login. It contains two groups:

**Financials**
- Dashboard
- Journal Entry
- Ledger View

**Reference**
- Chart of Accounts
- Reports
- Bank Reconciliation
- Settings

The currently active page is highlighted with a blue background. Your username, role, and a sign-out button appear at the bottom of the sidebar.

### Top Header Bar
The thin white bar at the top shows a breadcrumb (e.g. "GLPack > Dashboard") and the global search box on the right.

---

## 5. Dashboard

The Dashboard gives you an at-a-glance summary of the current financial year (from 1 January to today).

### KPI Cards

There are four summary cards across the top of the page:

| Card | What it shows |
|------|---------------|
| **Total Revenue** | Sum of all revenue-type account credits for the year to date |
| **Gross Profit %** | Gross profit divided by total revenue, expressed as a percentage |
| **Net Profit** | Profit after tax for the year to date (from the P&L calculation) |
| **Journal Entries** | Total number of journal transactions recorded this year |

If the backend is not running or data cannot be loaded, the cards show "—" and a warning banner appears at the top. While data is loading, the cards display a grey animated placeholder.

### Monthly Transaction Volume

A bar chart showing total debit activity per month for the current year. Each bar represents one month. Hover over a bar to see the month name and total amount. If there are no journal entries, the chart area shows "No data available" in a centred empty state.

### Quick Actions

A set of navigation shortcuts:
- **New Journal Entry** — goes to the Journal page ready to create an entry (requires Bookkeeper access or higher; disabled for Read Only users)
- **Chart of Accounts** — goes to the Accounts page
- **Trial Balance** — goes to the Reports page
- **Financial Statements** — goes to the Reports page

### Recent Journal Entries

A table showing the 8 most recent journal entries for the current year, sorted by date (newest first). Columns: TRX number, Date, Description, Amount. Clicking any row navigates to the Journal page. A "View all →" link in the top right goes to the full journal list. If no entries exist, the table shows "No journal entries found for this year."

---

## 6. Journal Entry

### Journal Entry List (default view)

When you open **Journal Entry** from the sidebar, you see a table of all journal transactions. Columns:

| Column | Description |
|--------|-------------|
| TRX | Transaction number (auto-assigned, zero-padded, e.g. `0042`) |
| Date | Entry date |
| Description | The `particular` text from the first line of the entry |
| Debit | Total debit amount for the transaction |
| Credit | Total credit amount for the transaction |
| (actions) | Edit / Delete buttons (Bookkeeper and above only) |

### Date Filters

Above the table is a date range filter. Enter a **From** date, a **To** date, or both, then click **Filter**. Leave both blank to see all entries. Click **Clear** to remove the filter.

### New Entry Button

Appears in the top-right corner for Bookkeeper and Administrator users. Clicking it opens the Journal Entry form.

---

### Journal Entry Form

The form is used to create or edit a journal entry.

#### Date Field
The date of the transaction. Defaults to today. Click the calendar or type a date in `YYYY-MM-DD` format. If the date falls in a locked period, saving will be rejected.

#### Lines Table

Each row in the table represents one line in the journal entry:

| Column | What to enter |
|--------|---------------|
| **Account** | The 4-character account code (e.g. `CB01`). Type to filter the dropdown. Up to 4 characters, automatically uppercased. Must be an existing account from the Chart of Accounts. |
| **Particular** | A description of what this line represents (e.g. "Cash sale"). Maximum 45 characters. Type to see suggestions from the phrase library. |
| **Debit** | The debit amount for this line. Enter a number; leave blank if this line is a credit. |
| **Credit** | The credit amount for this line. Enter a number; leave blank if this line is a debit. |
| **× button** | Removes this line (only shown when there is more than one line). |

#### Particular Autocomplete
As you type in the Particular field, a dropdown appears showing matching phrases from the phrase library. Each phrase may show default Dr/Cr account codes in brackets — for example:

```
Salary expense  [Dr:EX80 Cr:CB02]
```

Selecting a phrase fills only the description text. The account code fields are not filled automatically — you must type those separately. The bracket notation is informational only, reminding you which accounts are typically used with that description.

#### Add Line
Click **+ Add line** below the table to add a new blank row.

#### Balanced / Unbalanced Indicator
Below the table, the app shows running totals:
- **Total Dr** — sum of all debit amounts entered
- **Total Cr** — sum of all credit amounts entered
- A status pill:
  - **✓ Balanced** (green) — totals are equal and both are non-zero. The entry can be saved.
  - **Difference: X.XX** (amber) — totals do not match. Shows the gap.
  - **Enter amounts** (grey) — no amounts entered yet.

#### Why Debits Must Equal Credits
Every financial event has two sides. When you record a cash sale, cash increases (debit the bank account) and revenue increases (credit the sales account). Recording both sides keeps the books in balance. The system rejects an unbalanced entry at the API level as well as the UI level — it cannot be posted by any means unless totals match exactly.

#### Post Entry / Update Entry
Once the entry is balanced, click **Post Entry** (for a new entry) or **Update Entry** (when editing). The entry is written to the ledger, the TRX number is assigned, and you return to the list.

#### Edit
In the list view, click **Edit** on any row to open that entry in the form. Editing replaces all existing lines with the new set of lines you submit.

#### Delete
Click **Delete** on any row. The app asks "Delete? Yes / No" inline. Confirming permanently removes the entry from the ledger. Entries in locked periods cannot be deleted — you will see a toast notification explaining the restriction.

#### Permissions
- **Read Only (level 1):** Can see the list and open entries to view. No New, Edit, or Delete buttons are shown.
- **Bookkeeper (level 3+):** Full access to create, edit, and delete entries in open periods.
- **Locked period:** Even Administrators cannot edit or delete entries on or before the locked-through date.

#### Common Mistakes

| Mistake | Result |
|---------|--------|
| Account code not in the Chart of Accounts | Error: "Unknown account code(s)" |
| Debit total ≠ Credit total | Error: "journal is unbalanced" |
| Particular field left blank | Error: "particular cannot be empty" |
| Particular longer than 45 characters | Automatically truncated to 45 in the UI |
| Date in a locked period | Error: "Period locked through YYYY-MM-DD" |
| Debit and credit both entered on the same line | The second field clears the first (the form prevents both simultaneously) |

---

### Step-by-Step Example: Posting a Cash Sale

**Scenario:** The business received $500 cash for a sale on 15 March 2025.

1. Click **Journal Entry** in the sidebar.
2. Click **+ New Entry**.
3. Set the **Date** to `2025-03-15`.
4. On **Line 1**:
   - Account: `CB01` (or your cash/bank account code)
   - Particular: `Cash sale`
   - Debit: `500.00`
   - Credit: (leave blank)
5. On **Line 2**:
   - Account: `SA01` (or your sales account code)
   - Particular: `Cash sale`
   - Debit: (leave blank)
   - Credit: `500.00`
6. The status pill shows **✓ Balanced** (Total Dr: 500.00 = Total Cr: 500.00).
7. Click **Post Entry**.
8. You return to the journal list. The new entry appears with an auto-assigned TRX number.

---

## 7. Ledger View

The Ledger page shows all postings for **one account** in chronological order, with a running balance.

### Account Selector
A dropdown lists every account in the Chart of Accounts. Select the account you want to examine. You can also type to search.

### Date Range
Optionally enter a **From** date and/or **To** date to restrict the view to a specific period.

### Load Button
Click **Load** to fetch and display the ledger for the selected account. The Load button is disabled until an account is selected.

### Ledger Table Columns

| Column | Description |
|--------|-------------|
| Date | The date of the posting |
| TRX | Transaction number. Click to open that journal entry in the Journal page |
| Particular | The description text for that line |
| Debit | Amount posted as a debit on this line |
| Credit | Amount posted as a credit on this line |
| Balance | Running balance after this line (positive = Debit balance, negative = Credit balance; shown with a "Dr" or "Cr" label) |

The footer row shows total debits and total credits for the visible period.

### Export PDF
If you have filled in both a From date and a To date, an **Export PDF** button appears in the page header. Clicking it downloads a formatted PDF of the ledger for the selected account and date range.

### Empty States
- **Before loading:** A card prompts "Select an account and click Load to view its ledger."
- **After loading with no results:** "No transactions found for this account."

### When to Use This Page
Use the Ledger to:
- Investigate a specific account's activity (e.g. check all movements through the bank account)
- Find a specific posting to verify or correct it
- Confirm an opening or closing balance
- Produce a formal ledger report for audit purposes

---

## 8. Chart of Accounts

The Chart of Accounts page lists every account used in the system.

### Account Code
A short identifier of 1–4 uppercase characters. The first digit determines the account's category (1=Assets, 2=Liabilities, 3=Equity, 4=Revenue, 5=Expenses). Codes cannot be changed after creation.

### Account Name
A descriptive name of up to 30 characters (e.g. "Cash at Bank", "Office Rent"). Names can be edited after creation.

### Search and Filter
- **Search box** — type any part of a code or name to filter the list instantly.
- **Category dropdown** — filter by account prefix:
  - All categories
  - 1 — Assets
  - 2 — Liabilities
  - 3 — Equity
  - 4 — Revenue
  - 5 — Expenses

### Create Account (Admin only)
Click **+ New Account**. A modal appears:
- **Code:** Enter 1–4 characters. Automatically uppercased. Cannot duplicate an existing code.
- **Name:** Enter up to 30 characters.
- Click **Save** to create, or **Cancel** to close.

### Edit Account (Admin only)
Click **Edit** on any row. The same modal appears with the Name field pre-filled (the code field is locked for existing accounts). Update the name and click **Save**.

### Delete Account (Admin only)
Click **Delete** on any row. The app asks "Delete? Yes / No" inline. Confirming permanently removes the account. **Note:** If the account has any ledger entries, deletion may fail at the database level.

### How Account Codes Are Used Elsewhere
- Every journal entry line requires a valid account code from this list.
- The Ledger View uses codes to select which account to display.
- Reports group lines by account code prefix to compute revenue, expenses, assets, liabilities, etc.
- Bank Reconciliation automatically loads all entries where the account code starts with `CB`.

---

## 9. Reports

The Reports page provides seven financial reports. All reports require a **period start** and **period end** date.

### How to Generate a Report
1. Click **Reports** in the sidebar.
2. Select the report tab you want (see below).
3. Enter the **period start** and **period end** dates.
4. Click **Generate**.
5. The report appears in the card below.

### Exporting to PDF
- After generating a report, an **Export PDF** button appears. Click it to download a PDF of the current report.
- The **Download All (PDF)** button in the top-right (visible once dates are entered) downloads a combined PDF containing all financial statements (Expense Schedule, P&L, Balance Sheet, Debtors, Creditors, Fixed Assets) in one file.

---

### 9.1 Trial Balance

**What it shows:** Every account with non-zero activity in the selected period, showing total debits, total credits, and the net (Dr minus Cr). The footer shows grand totals — in a correct ledger, total debits always equal total credits.

**Use it to:** Verify the books are in balance before producing formal statements.

**Interpreting zero values:** An account with all-zero figures for the period will not appear in the list.

---

### 9.2 Profit & Loss

**What it shows:**
- Revenue lines (SA accounts) and total revenue
- Cost of Sales lines (CO accounts) and total cost of sales
- Gross Profit (revenue minus cost of sales)
- Other Income (OI accounts)
- Total Gross Revenue
- Expense lines (EX accounts) and total expenses
- Profit Before Tax
- Taxation (TX accounts)
- **Profit After Tax** — the bottom-line net profit
- P&L Brought Forward — the retained profit carried over from a previous period close
- **P&L Carried Forward** — profit after tax plus brought-forward balance

**Use it to:** Understand whether the business made a profit or loss, and how expenses break down against revenue.

**Percentage column:** Revenue lines show the percentage of total revenue.

---

### 9.3 Balance Sheet

**What it shows:** The financial position of the business at the end of the selected period.

Sections:
- **Equity:** Share capital (account code 3 prefix) and the Profit & Loss account (PL accounts)
- **Current Assets:** Accounts with prefix 1 that are classified as current assets
- **Current Liabilities:** Accounts with prefix 2
- **Net Current Assets:** Current Assets minus Current Liabilities
- **Fixed Assets:** Accounts with prefix 1 classified as fixed assets
- **Total Net Assets:** Net Current Assets plus Fixed Assets

The Balance Sheet should balance: Total Equity equals Total Net Assets.

---

### 9.4 Expense Schedule

**What it shows:** All expense accounts (EX prefix) with their amounts and percentage of total sales. Useful for a detailed breakdown of where money was spent.

---

### 9.5 Debtors Listing

**What it shows:** Accounts that represent amounts owed to the business (debtors/receivables). Shows account code, name, and balance. The report pulls balances from accounts that are configured as debtor accounts in the Chart of Accounts.

---

### 9.6 Creditors Listing

**What it shows:** Accounts that represent amounts the business owes to others (creditors/payables). Shows account code, name, and balance.

---

### 9.7 Fixed Assets

**What it shows:** Fixed asset accounts with three columns:
- **Cost** — the original cost posted to the asset account
- **Accum. Depn** — accumulated depreciation posted to the depreciation account
- **NBV** — Net Book Value (Cost minus Accumulated Depreciation)

---

### Empty / Zero Values in Reports
If a report shows "—" for an amount, the underlying value is zero, null, or could not be calculated. This usually means no transactions were posted to the relevant accounts in the selected period. This is not an error — it simply means there was no activity.

---

## 10. Bank Reconciliation

Bank reconciliation confirms that every movement in the bank statement matches a corresponding entry in the general ledger.

### How It Works
The page has two panels side by side:
- **Left:** Unmatched bank statement rows (imported from your CSV)
- **Right:** Unmatched GL Cash Entries (ledger entries where the account starts with `CB`)

You select one item from each panel and click **Match Selected** to link them. Once matched, the pair moves to the **Matched Pairs** table at the bottom.

### Importing a Bank CSV (Bookkeeper and above)

1. Click **Choose File** in the "Import bank CSV" bar.
2. Select your CSV file.
3. The file is uploaded and rows appear in the Unmatched Bank Rows panel.

**Required CSV columns** (column names are case-insensitive and whitespace is trimmed):

| Column | Description | Example |
|--------|-------------|---------|
| `date` | Transaction date | `2025-03-15` or `15/03/2025` or `15-03-2025` or `03/15/2025` |
| `description` | Narration or reference | `PAYMENT FROM ACME LTD` |
| `amount` | Amount (negative = debit/outflow) | `500.00` or `-250.00` |

The import accepts UTF-8 and Latin-1 encodings, and amounts may include currency symbols (`$`, `£`, `€`) and commas (e.g. `$1,250.00`).

**After import:** The count of imported rows appears (e.g. "Imported 42 row(s)").

### The Matching Process

1. Click a row in the **Unmatched Bank Rows** panel — it highlights blue with a left border.
2. Click the corresponding entry in the **Unmatched GL Cash Entries** panel.
3. Click **Match Selected**.
4. The pair disappears from both panels and appears in **Matched Pairs** below.

If you have selected from only one panel, a hint appears: "Select one item from each column."

### Unmatching

In the Matched Pairs table, click **Unmatch** on any row to move both items back to the unmatched panels.

### Summary Bar

The header shows three counts:
- **Total** — all bank rows ever imported
- **Matched** — rows that have been matched to a GL entry
- **Unmatched** — rows still needing a match

### Common Import Issues

| Problem | Likely cause |
|---------|-------------|
| "CSV missing column(s): date" | Column header is missing or spelled differently |
| "Row N: Unrecognised date" | Date format is not recognised — use YYYY-MM-DD |
| "Row N: Unrecognised amount" | Amount column contains text that is not a number |
| "Empty or unreadable CSV" | The file has no rows, or the encoding is not recognised |
| Import succeeds but no rows appear | The rows may already be matched, or the bank account code (`CB…`) is not in the GL |

---

## 11. Settings and Period Close

The Settings page is divided into three sections: Company Settings, Period Close, and Journal Phrases.

### Company Settings (Admin only)

| Field | Description |
|-------|-------------|
| **Company Name** | The name printed on PDF reports. Default: "Event Master 2020 PTE LTD" |
| **Currency** | A text label shown for amounts. Default: "SGD". This does not perform conversion — it is cosmetic. |
| **Financial Year End** | The month-day of the financial year end (e.g. `12-31`). Currently informational. |
| **Current Period** | A text label for the current accounting period (e.g. `2024-12-31`). Informational. |

Click **Save Settings** to persist changes. A confirmation message appears.

Non-admin users can view these fields but cannot edit them.

---

### Period Close (Admin only)

Closing a period is a **permanent, irreversible action**. Read this section carefully before proceeding.

**What closing a period does:**
1. Calculates the net balance of every P&L account (Sales, Cost of Sales, Other Income, Expenses, Taxation) up to the chosen close date.
2. Posts a single closing journal entry with the particular "BALANCE CARRIED DOWN" that zeroes all P&L account balances.
3. Transfers the net profit (or loss) to the Profit & Loss retained account (`PL01` or similar).
4. Sets the **locked_before** date — every journal entry on or before this date is permanently locked from editing or deletion.

**Before closing a period, you should:**
- Generate the Profit & Loss and Balance Sheet reports and verify the figures are correct.
- Ensure all bank reconciliation is complete for the period.
- Confirm there are no unresolved errors in the journal.

**How to close a period:**
1. Enter the **Period End Date** (e.g. `2024-12-31`).
2. Click **Close Period**.
3. A confirmation dialog appears showing the close date and warning that this cannot be undone.
4. Click **Yes, Close Period** to confirm.
5. A success message shows the number of closing lines written and the net profit transferred.

**After closing:**
- The "Currently locked through" date is displayed.
- The Profit & Loss report will show P&L Brought Forward from the closing entry.
- Attempting to edit or delete any entry in the locked period will show: "Period locked through YYYY-MM-DD".

**You cannot re-close a period that is already locked** — if the requested close date is on or before the existing locked-through date, the operation is rejected.

---

### Journal Phrases

Journal phrases are description templates used in the Particular field when posting journal entries.

**Viewing phrases:** All phrases are listed in a table showing the phrase text and optional default Dr/Cr account codes. Use the search box (top right of the panel) to filter.

**Adding a phrase (Bookkeeper and above):**
- Enter the **Phrase** text (max 45 characters)
- Optionally enter a **Dr Code** (the account code typically debited with this phrase)
- Optionally enter a **Cr Code** (the account code typically credited with this phrase)
- Click **Add**

The phrase immediately appears in the autocomplete dropdown when posting journal entries.

**Deleting a phrase (Bookkeeper and above):** Click **Delete** on any phrase row. This is immediate and permanent.

---

## 12. Global Search

### Opening the Search
Click the search box in the top-right corner of any page, or press **Ctrl+K** (Windows/Linux) or **Cmd+K** (Mac). Press **Escape** to close it.

### What It Searches
The search runs across three data sources simultaneously:
- **Accounts** — matches on account code or account name
- **Journal Entries** — matches on the `particular` (description) text of journal lines
- **Phrases** — matches on phrase text

Results appear as soon as you have typed at least 2 characters (with a short debounce delay). Up to 8 results per category are shown.

### How Results Are Grouped
Results are shown under section headers:
- **Accounts** — each result shows the code and name. Clicking navigates to the Chart of Accounts page.
- **Journal Entries** — each result shows the TRX number, description, and date. Clicking opens that specific journal entry in the form view.
- **Phrases** — shows the phrase text and any Dr/Cr codes. Clicking navigates to the Settings page.

A footer line shows the total number of results. If nothing matches, the panel shows: No results for "your query".

### Practical Use
Use global search to quickly find a transaction when you know part of its description but not the date or TRX number. For example, typing "rent" will surface all journal entries that have "rent" in any particular line.

---

## 13. User Management (Admin)

User management is handled through the backend API. There is no dedicated user management page in the current UI — administrators use the backend API documentation at `http://127.0.0.1:8000/docs` to manage users.

**Available operations (Admin only):**

| Operation | API endpoint |
|-----------|-------------|
| List all users | `GET /users` |
| Create a user | `POST /users` |
| Get a specific user | `GET /users/{id}` |
| Update username, password, or access level | `PUT /users/{id}` |
| Delete a user | `DELETE /users/{id}` |

**Creating a user:** POST to `/users` with `{"username": "jane", "password": "securepass", "access_level": 3}`.

**Access levels when creating:**
- `1` — Read Only
- `3` — Bookkeeper (can post entries, manage phrases, do reconciliation)
- `6` — Administrator (full access)

**Self-protection rules:**
- An administrator cannot reduce their own access level below 6.
- An administrator cannot delete their own account.

---

## 14. Typical Workflows

### How GLPack Fits Your Business Process

GLPack Modern is the place where your bookkeeping happens. The cycle looks like this:

```
START OF DAY / AS TRANSACTIONS HAPPEN
──────────────────────────────────────
 Double-click start.bat  →  backend + frontend open automatically
 Log in
 Post journal entries for today's transactions (sales, expenses, payments, receipts)
 Log out when done  —  all posted entries are saved permanently

WEEKLY / AS NEEDED
──────────────────
 Open Ledger View on any account to verify movements look correct
 Use Global Search (Ctrl+K) to find a specific transaction by description

MONTH-END
─────────
 Export bank statement from your bank as a CSV file
 Import CSV into Bank Reconciliation
 Match bank rows to GL cash entries until the unmatched count is zero
 Generate Trial Balance  →  verify it balances (total Dr = total Cr)
 Generate Profit & Loss  →  review net profit for the month
 Generate Balance Sheet  →  review financial position
 Export PDFs for your accountant, auditor, or internal records

YEAR-END (OR END OF ANY REPORTING PERIOD)
──────────────────────────────────────────
 Complete all entries and reconciliation for the period
 Generate and review all reports one final time
 Admin runs Period Close  →  P&L accounts zeroed, net profit transferred
 That period is now locked — no further changes possible
 New period begins with the carried-forward balance
```

**What you submit to your accountant or tax authority** is the PDF output from Reports — specifically the Profit & Loss, Balance Sheet, and any supporting schedules. GLPack itself is the working ledger; the PDFs are the formal output.

**Backing up your data:** Because the database lives on your machine, you should copy the database file to a safe location (external drive, cloud storage) regularly — ideally after every session. Ask your developer where the database file is located; it is typically `backend/glpack.db` or similar.

---

### Daily Transaction Entry
1. Open **Journal Entry**.
2. Click **+ New Entry**.
3. Set the date to today.
4. Add lines for each account affected, using phrase autocomplete to speed up descriptions.
5. Confirm the **✓ Balanced** indicator.
6. Click **Post Entry**.

### Reviewing a Ledger Account
1. Open **Ledger View**.
2. Select the account from the dropdown.
3. Enter the date range if needed.
4. Click **Load**.
5. Review the running balance column to spot unexpected movements.
6. Click any TRX number to jump to the full journal entry.

### Generating Month-End Reports
1. Open **Reports**.
2. Set the period start to the first day of the month, period end to the last day.
3. Generate **Trial Balance** first to verify the books are in balance.
4. Generate **Profit & Loss** to review net profit.
5. Generate **Balance Sheet** to confirm financial position.
6. Click **Export PDF** for each report you need to file, or **Download All (PDF)** for a combined package.

### Reconciling Bank Transactions
1. Export a statement from your bank as a CSV file with date, description, and amount columns.
2. Open **Bank Reconciliation**.
3. Click **Choose File** and select the CSV.
4. Once imported, work through the unmatched bank rows panel and unmatched GL entries panel.
5. Select one from each panel, click **Match Selected**.
6. Repeat until all expected items are matched.
7. Check the summary bar shows the expected counts of matched vs unmatched.

### Closing a Period
1. Complete all journal entries for the period.
2. Run the **Trial Balance** and verify it balances.
3. Run **Profit & Loss** and review the net profit figure.
4. Open **Settings**.
5. In the **Period Close** section, enter the last date of the period.
6. Click **Close Period** and confirm.
7. Note the result — it shows how many closing lines were written and the net profit transferred.

### Finding an Old Transaction
1. Press **Ctrl+K** to open global search.
2. Type any part of the description, account name, or TRX number.
3. Click the result to navigate directly to that entry.

### Adding a New Account
1. Open **Chart of Accounts** (requires Admin).
2. Click **+ New Account**.
3. Enter the code (e.g. `EX81`) and name (e.g. "Printing & Stationery").
4. Click **Save**.
5. The account is now available in journal entry account dropdowns.

### Using Phrase Templates to Speed Up Entry
1. Open **Settings** (Bookkeeper or above).
2. In the **Journal Phrases** section, add a new phrase:
   - Phrase: `Monthly office rent`
   - Dr Code: `EX10` (your rent expense account)
   - Cr Code: `CB01` (your bank account)
3. Next time you post an entry, type "rent" in the Particular field — the phrase appears in the dropdown. Select it to fill in the description. You still need to enter the account codes and amounts manually.

---

## 15. Troubleshooting

### Cannot Log In
- Check the username and password are correct. Usernames are case-sensitive.
- If the backend server is not running, the login request will fail with a network error. Start the backend.
- If you have been logged in for more than 8 hours, your session has expired. Log in again.

### Backend Not Running
Symptoms: Login fails, Dashboard shows a warning banner, reports fail to load.

Start the backend:
```
cd backend
uvicorn app.main:app --reload
```
The API should be accessible at `http://127.0.0.1:8000`.

### Frontend Not Connecting to Backend
If the frontend loads but all data requests fail, check:
- The backend is running at `http://127.0.0.1:8000`
- No firewall or proxy is blocking port 8000
- The frontend `.env` or API base URL configuration points to the correct host

### Empty Dashboard
If all KPI cards show "—" and there is a yellow warning:
- The backend may be down (check the backend is running)
- There may be no journal entries for the current year
- The P&L data may require accounts with the correct prefixes (SA, CO, EX, etc.)

### No Accounts Showing
- The Chart of Accounts may not have been seeded. Run the account seed script.
- Check that the backend is running and can reach the database.

### Cannot Save a Journal Entry
Common reasons:
- The entry is unbalanced (total debit ≠ total credit). Check the balance indicator.
- An account code is not in the Chart of Accounts ("Unknown account code(s)").
- The date is in a locked period ("Period locked through YYYY-MM-DD").
- A particular field is empty or longer than 45 characters.
- Your access level is Read Only (level 1) — you need level 3 or above.

### Entry Is Unbalanced
The status pill shows **Difference: X.XX** in amber. This means the debit total and credit total differ by that amount. Review each line and adjust the figures until the pill shows **✓ Balanced**.

### PDF Export Does Not Download
- Ensure you have clicked **Generate** first (for individual reports) or that the date range is filled (for Download All).
- Some browsers block automatic file downloads. Check the browser's download bar or permissions.
- If a network error occurs, the PDF export failed on the server side. Check the backend logs.

### Bank CSV Import Fails
Check that:
- The file has headers named `date`, `description`, and `amount` (case-insensitive)
- Dates are in a supported format: `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, or `MM/DD/YYYY`
- Amounts are numeric (commas and currency symbols are stripped automatically)
- The file is not empty

If a specific row fails, the error message includes the row number.

### Period Is Locked
If you see "Period locked through YYYY-MM-DD" when trying to edit or delete an entry, that entry's date falls in a closed period. Closed periods cannot be re-opened. Contact your Administrator to confirm whether the close date was set correctly.

### Search Returns No Results
- The search requires at least 2 characters.
- Only the `particular` field of journal lines is searched, not dates or amounts.
- Account search matches on code and name.
- If the backend is not running, search silently returns no results.

---

## 16. Appendix

### Default Local Development URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://127.0.0.1:8000 |
| Backend API docs (Swagger) | http://127.0.0.1:8000/docs |

### Starting the Application

#### One-click launch (normal daily use)

Double-click **`start.bat`** in the root project folder. It will:
1. Activate the Python virtual environment
2. Start the backend in a terminal window titled "GLPack — Backend"
3. Start the frontend in a terminal window titled "GLPack — Frontend"
4. Open `http://localhost:5173` in your default browser after a short delay

To stop the application, close both terminal windows.

#### Manual start (if needed)

**Backend:**
```
cd backend
uvicorn app.main:app --reload
```

**Frontend:**
```
cd frontend
npm run dev
```

#### First-time setup only

**Database migration:**
```
cd backend
alembic upgrade head
```

**Seed data (accounts, phrases, default admin user):**
```
cd backend
python seed/run_all.py
```

---

### Glossary of Fields and Accounting Terms

| Term | Definition |
|------|-----------|
| **Account code** | 1–4 character identifier for a ledger account (e.g. `CB01`, `SA02`) |
| **Accum. Depn** | Accumulated Depreciation — the total depreciation charged against an asset to date |
| **Balance brought down (b/d)** | The opening balance of an account at the start of a new period |
| **Balance carried down (c/d)** | The closing entry that zeroes an account at period end, carried to the next period |
| **Balance sheet** | Financial statement showing what the business owns (assets) and owes (liabilities and equity) |
| **Bank reconciliation** | Matching bank statement entries to GL cash entries to confirm the books reflect all movements |
| **Bookkeeper** | A user with access level 3 who can post and edit journal entries |
| **CB** | Account code prefix for Cash/Bank accounts |
| **Chart of Accounts** | The complete list of all accounts used in the general ledger |
| **CO** | Account code prefix for Cost of Sales accounts |
| **Credit (Cr)** | An entry on the right side of a ledger account; increases liabilities, equity, and revenue; decreases assets and expenses |
| **Current assets** | Assets expected to be converted to cash within one year (accounts with prefix 1, excluding fixed assets) |
| **Current liabilities** | Amounts owed and due within one year (accounts with prefix 2) |
| **Debit (Dr)** | An entry on the left side of a ledger account; increases assets and expenses; decreases liabilities, equity, and revenue |
| **EX** | Account code prefix for general Expense accounts |
| **Financial year** | The 12-month accounting period for the business |
| **Fixed assets** | Long-term assets not expected to be converted to cash within one year |
| **General ledger** | The complete record of all financial transactions; the core database of GLPack Modern |
| **Gross profit** | Revenue minus Cost of Sales |
| **Journal entry** | A record of one financial transaction with matching debit and credit lines |
| **Locked period** | A period that has been closed; entries cannot be edited or deleted |
| **NBV** | Net Book Value — original cost of an asset minus accumulated depreciation |
| **Net profit** | Gross profit plus other income minus expenses, before and after tax |
| **OI** | Account code prefix for Other Income accounts |
| **Particular** | The description text on a journal line (maximum 45 characters) |
| **Period close** | The process of zeroing P&L accounts and locking the period |
| **Phrase** | A saved description template with optional default Dr/Cr account codes |
| **PL** | Account code prefix for the Profit & Loss retained earnings account |
| **Profit & Loss (P&L)** | Financial statement showing revenue, expenses, and net profit for a period |
| **SA** | Account code prefix for Sales/Revenue accounts |
| **Trial balance** | A list of all accounts with debit and credit totals; used to verify the ledger is in balance |
| **TRX** | Transaction number — the unique identifier for a journal entry (auto-assigned, zero-padded to 4 digits) |
| **TX** | Account code prefix for Taxation accounts |
| **Write access** | Access level 3 or above — required to create or modify entries |
