# Investor OS

Investor OS is a local-first portfolio analytics cockpit. It imports portfolio
data in the browser, stores it in `localStorage`, and calculates holdings,
sector exposure, concentration, performance, and local rule-based insights.

## Live GitHub Pages Site

After GitHub Pages is enabled for this repository, the public static viewer is:

https://robotaitai.github.io/trader/

The Pages deployment is handled by `.github/workflows/pages.yml`.

## Privacy Model

- The public website is only the viewer.
- Uploaded portfolio files are parsed in the user's browser.
- Data is saved in that browser's `localStorage`.
- Data is not committed to GitHub and is not shared with other visitors.
- Browser data is per-device and can be cleared by the user.

Real portfolio files should stay out of the repo. Keep private files under
`private/` or use `*.private.csv`, `*.private.tsv`, or `*.private.xlsx`.

## How Someone Adds Their Data

1. Open the website and go to `Sync Settings`.
2. Click `Download Investor OS workbook`.
3. Fill the workbook in Excel or Google Sheets.
4. Upload the workbook back into `Sync Settings`.
5. Click `Save status locally` or `Import into localStorage`.
6. Review Overview, Holdings, Sectors, Exposure Map, and Performance Lab.

The workbook contains these sheets:

- `Portfolio Snapshot`: current holdings and closed rows.
- `Transactions`: optional transaction ledger.
- `Price History`: optional daily prices for static GitHub Pages mode.
- `Security Metadata`: optional ticker/name/sector/exchange overrides.
- `Instructions`: required fields and examples.

For the simplest workflow, fill `Portfolio Snapshot`.

Required snapshot columns:

- `Ticker`
- `Shares`
- `Purchase Price`

Recommended snapshot columns:

- `Security Type`
- `Purchase Date`
- `Current Price`
- `Value USD`
- `Cost Basis`
- `Status`
- `Sold Date`
- `Sold Price`
- `Final Earning`
- `Active Earning`

## Using ChatGPT to Convert Broker Files

Users can upload broker PDFs/statements to ChatGPT and ask it to create the
Investor OS workbook format.

Suggested prompt:

```text
Convert these broker statements into an Investor OS workbook.

Use these sheets:
1. Portfolio Snapshot
2. Transactions
3. Price History, if daily prices are available
4. Security Metadata, if company names/sectors are available

For Portfolio Snapshot, use these columns:
Ticker, Security Type, Shares, Purchase Date, Purchase Price, Current Price,
Value USD, Cost Basis, Ernings Prct, Sold Date, Sold Price, Stop Loss Price,
Status, Final Earning, Active Earning

For Transactions, use:
date, ticker, action, quantity, price, currency, fees, notes

Valid actions:
BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAWAL, FEE, TAX

Do not invent values. Leave unknown cells blank.
```

## Price History and GitHub Pages

GitHub Pages is static and cannot run the app's `/api/price-history` route.

For GitHub Pages:

- Daily and Weekly performance work best when the uploaded workbook includes a
  `Price History` sheet.
- Required `Price History` columns are `date`, `ticker`, and `close`.
- If no price-history sheet exists, the app falls back to estimated
  month-or-higher performance using local transaction/snapshot dates.

For local development or serverless hosting such as Vercel/Netlify:

- The `/api/price-history` route can fetch Yahoo Finance daily adjusted closes.
- Sync Settings attempts to fetch daily prices after saving/importing data.

## Development

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run lint
npm run build
```

Static GitHub Pages export can be tested with:

```bash
tmpdir=$(mktemp -d)
mv app/api "$tmpdir/api"
trap 'mv "$tmpdir/api" app/api; rmdir "$tmpdir"' EXIT
NEXT_OUTPUT=export NEXT_PUBLIC_BASE_PATH=/trader npm run build
```

The Pages workflow performs the same static build in CI by removing `app/api`
inside the temporary GitHub Actions workspace before export.
