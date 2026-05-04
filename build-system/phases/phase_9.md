Phase 9 — Journal Entry

Goal:
Build the core journal entry workflow in the browser.

Requirements:
- Dynamic journal entry rows.
- Date picker or date input.
- Account autocomplete/search using accounts API.
- Particular autocomplete/search using phrases API.
- Dr amount and Cr amount fields.
- Live debit/credit totals.
- Live balance indicator.
- Save disabled until balanced.
- POST balanced entry to /journal-entries.
- Load and edit existing entries.
- Recent journal entries list.

Likely files to touch:
- frontend/src/pages/JournalEntry/*
- frontend/src/api/journal.*
- frontend/src/api/accounts.*
- frontend/src/api/phrases.*
- frontend/src/components/* only if needed

Read constraints:
- Do NOT break backend API contract.
- Do NOT modify backend unless endpoint mismatch is confirmed.
- Do NOT read full documentation.
- Accuracy > styling.

Validation:
- Can create a balanced journal entry.
- Cannot save an unbalanced entry.
- Can load/edit existing entry.
- API errors show clearly.
