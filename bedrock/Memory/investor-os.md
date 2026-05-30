---
note_type: memory-branch
project: trader2
updated: 2026-05-31
---

# Investor OS

## Product Surface

Investor OS is a premium, dense, professional portfolio cockpit with a left
sidebar and local-only data model.

Implemented navigation:

- Overview
- Holdings
- Performance Lab
- Exposure Map
- Sectors
- Investor Mirror, disabled placeholder
- Decision Journal, disabled placeholder
- AI Coach, disabled placeholder
- Sync Settings

## Pages

`/overview` shows portfolio value, unrealized P&L, realized P&L, placeholder
estimated XIRR, HHI concentration, a mock-scaled portfolio value chart, sector
allocation donut, and top winners/losers.

`/holdings` shows a TanStack Table holdings ledger with global search, sector
filtering, and sorting by ticker, market value, P&L, and weight.

`/performance-lab` shows weighted return, scenario value, best/worst
contributors, monthly flow-adjusted performance, a monthly return ledger, a
position contribution chart, local stress-test controls, a scenario impact
table, and deterministic local agent notes.

`/exposure-map` shows largest position, top-three weight, HHI, sector count, a
sector-first risk map, sector weight chart, exposure detail table, and
deterministic local agent exposure notes. Closed positions are shown in a
separate realized-history section and do not count toward active exposure.

`/sectors` shows sector aggregation and a sector allocation chart.

`/sync-settings` supports two local import flows:

- Transaction ledger import from CSV/XLSX with preview, auto-mapping,
  required-column validation, and localStorage save.
- Current portfolio snapshot import from CSV/TSV/XLSX or pasted text, with
  preview and localStorage save.

## Phase Boundaries

Current phase is explicitly local-first. Do not add backend services,
authentication, databases, Google Sheets sync, or real AI features unless the
product direction changes.

Performance Lab and Exposure Map include local rule-based notes in places where
future agentic behavior may live. These are deterministic and do not call an AI
service.
