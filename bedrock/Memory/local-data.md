---
note_type: memory-branch
project: trader2
updated: 2026-05-31
---

# Local Data

## Domain Types

Domain types live in `lib/types.ts`:

- `Transaction`
- `SecurityMetadata`
- `Holding`
- `PortfolioSummary`
- `SectorExposure`
- `WinnerLoser`
- `PortfolioSnapshotRow`
- `DecisionJournalEntry`

Transaction actions are `BUY`, `SELL`, `DIVIDEND`, `DEPOSIT`, `WITHDRAWAL`,
`FEE`, and `TAX`.

Portfolio snapshots support `Active` and `Closed` status rows.

## Analytics

Analytics live in `lib/analytics.ts`.

Implemented functions:

- `calculateHoldings`
- `calculateHoldingsFromSnapshot`
- `calculatePortfolioSummary`
- `calculateSectorExposure`
- `calculateTopWinnersLosers`
- `calculateHhi`
- `calculateSnapshotRealizedPnl`

Performance and exposure helper functions live in `lib/portfolio-lab.ts`:

- `calculateWeightedReturn`
- `calculateContributionRows`
- `calculateScenarioRows`
- `generatePerformanceInsights`
- `generateExposureInsights`
- `buildExposureTiles`
- `calculateMonthlyPerformance`

Transaction-derived holdings use average cost. For uploaded tickers that do not
have mock current prices, the last trade price is used as a fallback current
price.

When a saved current portfolio snapshot exists, active snapshot rows drive
dashboard holdings. Closed snapshot rows contribute to realized P&L through
`finalEarning`.

The current "agentic" analysis is deterministic local logic over holdings,
sector exposure, summary, HHI, and scenario inputs.

Snapshot-derived holdings are aggregated by ticker before display. Multiple
active rows for the same ticker should produce one canonical holding/exposure.
Ticker normalization removes whitespace and non-ticker characters before
aggregation, so stale local rows with hidden spacing still collapse.

Closed snapshot rows are excluded from active holdings/exposure. A row is
treated as closed if `status` is Closed or if it has sold date, sold price, or
final earning fields. Closed rows are converted into realized-history records
for Exposure Map.

Imported snapshot `Security Type` values such as Stock and ETF are asset types,
not sectors. The app should infer professional sector buckets from known tickers
or fall back to `Unclassified Equity` / `Diversified Fund`, never display Stock
or ETF as a sector.

Security classification has curated mappings for the user's active/imported
symbols, including semiconductors, software, communication services, healthcare,
aerospace and defense, nuclear energy, clean energy equipment, utilities,
materials, consumer discretionary, and fund sleeves. Fund/index sleeves are
identified by `isFundExposureBucket` so Sectors can separate true stock sectors
from ETFs and other pooled products.

Monthly performance separates net flow from gain/loss using available local
transaction dates or snapshot purchase/sold dates. If the user only provides a
current snapshot without dates, the app should show an insufficient-history
state instead of inventing a time series.

Performance Lab can fetch daily adjusted-close price history through the local
`/api/price-history` route. The route queries Yahoo Finance's chart endpoint
for each ticker and stores fetched rows in `investor-os.price-history` in
localStorage. Monthly flow-adjusted performance should prefer this daily price
history when available.

When calculating monthly performance from portfolio snapshots, incomplete lots
without purchase dates are excluded from the monthly return engine. A sale date
without a matching purchase date must not create a synthetic SELL by itself,
because that can produce impossible monthly return spikes. Daily price-history
fetches include active holdings plus dated snapshot lots so closed positions
with complete dates have price coverage.

## Persistence

Persistence is browser-only in `lib/storage.ts`.

localStorage keys:

- `investor-os.transactions`
- `investor-os.security-metadata`
- `investor-os.current-prices`
- `investor-os.portfolio-snapshot`
- `investor-os.price-history`
- `investor-os.decision-journal`

The default active portfolio is empty until the user imports transactions,
saves a current portfolio snapshot, or explicitly loads demo data. `loadDemoData`
loads mock transactions and clears the saved portfolio snapshot. `clearLocalData`
clears local transactions and snapshots.

Transaction imports, snapshot saves, and snapshot clears also clear
`investor-os.price-history` so Performance Lab does not reuse stale historical
prices for an old ticker set.

Sync Settings has an `Update current prices` action for saved active portfolio
snapshots. It fetches recent daily prices through `/api/price-history`, updates
active rows' `currentPrice`, `valueUsd`, `activeEarning`, and `earningsPct`, and
clears stale price history.

Decision Journal entries are stored locally under `investor-os.decision-journal`
and are read by Investor Mirror for process analysis.

## Import Formats

Transaction imports require mapped columns for date, ticker, action, quantity,
and price. Optional columns include currency, fees, and notes.

Portfolio snapshot imports support headers such as Ticker, Security Type,
Shares, Purchase Price, Current Price, Value USD, Value NIs, Cost Basis,
Ernings Prct, Sold Date, Sold Price, Stop Loss Price, Status, Final Earning,
and Active Earning. Header matching normalizes punctuation and casing.

Snapshot number parsing accepts `$`, `₪`, quotes, commas, percent signs, and
spaces.

## Private Data

Real portfolio files belong in `private/` or in `*.private.csv`,
`*.private.tsv`, or `*.private.xlsx` files. These are ignored by `.gitignore`.

The local sample/private status file is `private/portfolio-status.tsv`; it must
not be force-added if this project becomes a public repo.
