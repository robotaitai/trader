---
note_type: work-now
project: trader2
updated: 2026-05-31
---

# Now

## Current focus

Investor OS Phase 1 now includes Overview, Holdings, Performance Lab, Exposure
Map, Sectors, and Sync Settings. The current focus is hardening import behavior,
validating the new lab/map views with real portfolio data, and keeping private
portfolio data out of the publishable source tree.

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

## Next recommended actions

1. Manually run the app and exercise both import flows in `/sync-settings` with
   realistic CSV/TSV/XLSX files.
2. Review Performance Lab and Exposure Map against real holdings to tune
   deterministic agent rules and risk thresholds.
3. Decide whether portfolio snapshots should continue to override transaction
   holdings, or whether the UI should expose a data-source selector.
4. Add focused tests for analytics and import parsing before expanding Phase 2
   features.

## Open questions

- How should sectors be assigned for tickers imported only through portfolio
  snapshots when no `SecurityMetadata` exists?
- Should closed snapshot rows appear anywhere in the UI, or only contribute to
  realized P&L?

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
