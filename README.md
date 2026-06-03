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

## Storage Modes

The code is public; your data is not. There is **no cloud account, API, or
sign-in** involved — your portfolio is simply a file you control. Manage it in
`Sync Settings` under `Storage mode`.

- **Per device (default).** Your portfolio stays in this browser's
  `localStorage`. Nothing leaves the device, no setup required. Because
  `localStorage` is per-browser, data does not follow you to another device on
  its own — that is what the two file options below are for.
- **Export / Import a file.** Download your whole portfolio as a single
  `investor-os-portfolio.json` file, or load one back. Works on **any** device,
  including phones. Move the file however you like: drop it in a cloud drive you
  already use, AirDrop it, or email it to yourself.
- **Link a file (auto-save).** Pick a file once — ideally inside a folder your
  operating system already syncs (Google Drive, iCloud, Dropbox) — and the app
  **auto-saves to it** whenever your data changes. Your existing drive client
  then syncs that file to every device automatically. This uses the browser's
  File System Access API and is available on **desktop Chrome/Edge** (not iOS
  Safari); on phones, use Export / Import instead.

In every mode, `localStorage` stays the live working copy that all views read
from. The file is just the portable copy.

### How to sync across devices

The simplest, most private setup needs no configuration:

1. On your PC (Chrome/Edge), open `Sync Settings` → **Create new file** and save
   `investor-os-portfolio.json` inside your **Google Drive (or iCloud/Dropbox)**
   folder. Enable **Auto-save**.
2. Edit your portfolio normally. The app keeps the file up to date, and your
   drive app syncs it to the cloud.
3. On another PC, **Link existing file** and point at the same synced file. When
   the file is newer than that device, it loads automatically on open.
4. On a phone (or any browser without file linking), use **Download my data** /
   **Load data from file** with the same synced file.

Syncing is last-write-wins based on a stored last-modified time, so the most
recently edited copy takes precedence. Edit on one device at a time to avoid
overwriting newer changes.

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
npm test
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
