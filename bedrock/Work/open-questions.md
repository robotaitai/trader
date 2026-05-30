---
note_type: open-questions
project: trader2
updated: 2026-05-31
---

# Open Questions

Questions that are not resolved yet.

## Open

- Should portfolio snapshot data override transaction-derived holdings whenever
  present, or should the user choose the active source?
  - Why it matters: The current behavior is simple but implicit.
  - Related context: `Memory/local-data.md`

- How should imported tickers receive company names, sectors, currencies, and
  exchanges when they are not in mock metadata?
  - Why it matters: Sector exposure quality depends on metadata.
  - Related context: `Memory/local-data.md`

- Should closed snapshot rows be visible in a separate realized/closed positions
  view?
  - Why it matters: Closed rows currently affect realized P&L but are not shown
  as a table.
  - Related context: `Memory/investor-os.md`
