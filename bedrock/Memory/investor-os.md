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
- Investor Mirror
- Decision Journal
- AI Coach, disabled placeholder
- Sync Settings

## Pages

`/overview` is the main portfolio cockpit. It shows source/status badges,
portfolio value, cost basis, unrealized P&L, latest monthly return, top-three
weight, HHI concentration, value-over-time, performance pulse, top holdings,
position contribution, sector allocation, risk/attention notes, and
winners/losers. Ticker rows include an info action that opens a local
explanation panel for the symbol, name, sector, role, quantity, cost basis,
current price, market value, unrealized P&L, and activity dates.
The value-over-time chart uses canonical monthly dates, range controls
(`6M`, `1Y`, `3Y`, `All`), daily/weekly/monthly/quarterly/yearly aggregation
when daily price history exists, value/return/candle views, legends, full
period labels in tooltips, and range move/gain-loss/net-flow readouts.

`/holdings` shows a TanStack Table holdings ledger with global search, sector
filtering, and sorting across all displayed data columns.

`/performance-lab` shows weighted return, scenario value, best/worst
contributors, monthly flow-adjusted performance, a monthly return ledger, a
position contribution chart, local stress-test controls, a scenario impact
table, and deterministic local agent notes.

Performance Lab also shows an open-vs-closed lot contribution table so tickers
with both active and closed lots are not misread as a single blended return.
The chart is labeled as active unrealized contribution.

`/exposure-map` shows largest position, top-three weight, HHI, sector count, a
sector allocation treemap, sector investment detail, sector-first risk map,
sector weight chart, exposure detail table, and deterministic local agent
exposure notes. The treemap sizes rectangles by active market value and shows
sector weight plus total invested cost basis. Closed positions are shown in a
separate realized-history section and do not count toward active exposure.

`/sectors` separates economic stock-sector exposure from ETF/fund sleeves.
Stocks are grouped into curated buckets such as Semiconductors, Software,
Communication Services, Aerospace & Defense, Nuclear Energy, and Clean Energy
Equipment. ETFs/funds are shown separately as sleeves such as Broad Market,
Growth Index, Options Income, Bitcoin, and Space & Defense Fund. The page also
surfaces unclassified active holdings when taxonomy coverage is incomplete.

`/investor-mirror` shows a local behavioral/process audit: process score,
journal coverage, review queue, closed-trade diagnostics, process checklist,
and deterministic local mirror notes.

`/decision-journal` stores local decision entries with ticker, decision, thesis,
risk, confidence, open/reviewed status, and delete/review actions.

`/sync-settings` supports two local import flows:

- Transaction ledger import from CSV/XLSX with preview, auto-mapping,
  required-column validation, and localStorage save.
- Current portfolio snapshot import from CSV/TSV/XLSX or pasted text, with
  preview and localStorage save.

Saved current portfolio snapshots can refresh active current prices from the
local Yahoo-backed price-history route.

Tables across Overview, Performance Lab, Exposure Map, Sectors, Investor
Mirror, Decision Journal, and Sync Settings expose sortable headers for their
displayed data fields. Non-data action/info controls are intentionally static.

## Phase Boundaries

Current phase is explicitly local-first. Do not add backend services,
authentication, databases, Google Sheets sync, or real AI features unless the
product direction changes.

Performance Lab and Exposure Map include local rule-based notes in places where
future agentic behavior may live. These are deterministic and do not call an AI
service.

Investor Mirror also uses deterministic local notes. It reads holdings, sector
exposure, closed positions, and the local decision journal to simulate a basic
process-review agent without calling an AI service.
