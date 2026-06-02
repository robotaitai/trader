---
note_type: work-now
project: trader2
updated: 2026-05-31
---

# Now

## Current focus

Investor OS Phase 1 now includes Overview, Holdings, Performance Lab, Exposure
Map, Sectors, Investor Mirror, Decision Journal, and Sync Settings. The current
focus is hardening import behavior, validating the analysis views with real
portfolio data, and keeping private portfolio data out of the publishable source
tree.

The app now avoids auto-loading fake holdings. Users must import/paste their
portfolio or explicitly load demo data.

Exposure Map now groups by sector and snapshot holdings are aggregated by ticker
to avoid duplicate exposure rows. Performance Lab now includes monthly
flow-adjusted performance where dated local data exists.

The latest Exposure Map cleanup replaces raw asset-type sectors with inferred
professional sector buckets and replaces generic `Read` labels with portfolio
roles.

Closed positions are now separated from active exposure in Exposure Map.

Performance Lab now has a `Fetch daily prices` action backed by
`/api/price-history`, and the monthly performance chart uses readable month
labels.

The monthly performance card now explicitly labels whether it is using estimated
fallback data or fetched daily prices.

Investor Mirror is enabled and reads local holdings, closed positions, sector
exposure, and decision journal entries to produce a process score, review queue,
closed-trade diagnostics, and deterministic local notes.

Decision Journal is enabled and stores decisions locally under
`investor-os.decision-journal`.

Overview has been expanded from a thin summary into the main cockpit: source
badges, value/performance/risk metrics, value-over-time, performance pulse,
top holdings with ticker info actions, contribution chart, sector allocation,
risk notes, and winners/losers.

Performance Lab monthly returns now guard against incomplete snapshot lots:
closed rows without purchase dates no longer create unmatched synthetic SELL
flows, and months with missing price coverage are skipped instead of valuing
positions at zero. It also separates active unrealized contribution from closed
realized lots.

Sync Settings can refresh saved active snapshot prices through the local
Yahoo-backed price-history route.

Sector allocation has been upgraded with a broader curated ticker taxonomy and
a clearer Sectors page that splits economic stock sectors from ETF/fund sleeves.
Unclassified active holdings are explicitly surfaced instead of silently
polluting allocation quality.

Table sorting has been hardened across the app: Holdings sorts every displayed
data column through TanStack Table, and the remaining analytics/import tables
use a shared sortable header helper. Action/info-only columns remain static.

Overview's performance chart now has value, flow-adjusted return, and candle
views with daily/weekly/monthly/quarterly/yearly aggregation, richer legends,
cleaner axes, and range-level gain/loss/net-flow summaries. Daily and weekly
views require fetched daily price history; otherwise the UI falls back to
monthly-or-higher data.

Sync Settings now fetches daily price history immediately after transaction
imports and current snapshot saves. This keeps Overview from staying in
estimated mode after upload.

GitHub Pages publishing is configured through `.github/workflows/pages.yml`.
Static export uses `/trader` as the base path and removes server routes only in
the Actions workspace. README documents the live Pages URL, the local privacy
model, workbook instructions, a ChatGPT conversion prompt, and the price-history
sheet requirement for fully static daily/weekly performance.

## Next recommended actions

1. Manually run the app and exercise both import flows in `/sync-settings` with
   realistic CSV/TSV/XLSX files.
2. Review Overview, Performance Lab, and Exposure Map against real holdings to tune
   deterministic agent rules and risk thresholds.
3. Review Investor Mirror and Decision Journal against real use to tune process
   thresholds and journal fields.
4. Decide whether portfolio snapshots should continue to override transaction
   holdings, or whether the UI should expose a data-source selector.
5. Add focused tests for analytics and import parsing before expanding Phase 2
   features.

## Open questions

- How should sectors be assigned for tickers imported only through portfolio
  snapshots when no `SecurityMetadata` exists?
- Should Decision Journal entries support explicit review dates and price
  targets?

## Risks

- SheetJS/xlsx has known audit advisories with no fix available in the pinned
  package. Import files should be treated as local trusted user files for now.
- `private/` is ignored, but a future Git repo could still expose private data
  if files are force-added.

## Context to load first

- Memory/PROJECT.md
- Memory/decisions.md
- Memory/investor-os.md
- Memory/local-data.md
- Memory/frontend.md
