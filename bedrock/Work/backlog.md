---
note_type: backlog
project: trader2
updated: 2026-05-31
---

# Backlog

Use this for useful future work. Keep it short and reviewable.

## Open

- [ ] Add analytics/import unit tests, because average-cost and snapshot parsing
  should stay stable as formats expand.
- [ ] Add tests for `lib/portfolio-lab.ts`, because Performance Lab and
  Exposure Map depend on deterministic local insight rules.
- [ ] Add a data-source indicator or toggle, because saved snapshots currently
  override transaction-derived holdings implicitly.
- [ ] Add editable security metadata, because uploaded tickers without metadata
  fall back to ticker names and broad sectors.

## Later

- [ ] Implement realized P&L from transaction sales, because Phase 1 currently
  only has snapshot-based realized P&L and a transaction placeholder.
- [ ] Add XIRR calculation, because the Overview metric is currently a
  placeholder.
- [ ] Evaluate a maintained spreadsheet parser alternative if SheetJS/xlsx audit
  advisories become unacceptable for the project.
