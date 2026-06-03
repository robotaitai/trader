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

The code is public; your data is not. You choose where the data lives in
`Sync Settings` under `Storage mode`:

- **Per device (default).** Your portfolio stays in this browser's
  `localStorage`. Nothing leaves the device. This is the original behavior and
  needs no setup. Note that `localStorage` is per-browser, so data does not
  follow you to another device on its own.
- **Google Drive sync (optional).** Your portfolio is saved as a single private
  file in your own Google Drive, so you can load the same data on your PC,
  phone, and other devices. The file lives in Drive's hidden `appDataFolder` —
  an app-only area that does not appear in your normal Drive and that no other
  app or website can read. The app only ever requests the narrow
  `drive.appdata` scope.

`localStorage` always stays the live, working copy that every view reads from.
Drive is the cross-device backing store you push to and pull from:

- **Push to Drive** overwrites the Drive copy with this device's data.
- **Pull from Drive** overwrites this device with the Drive copy, then reloads.
- **Auto-pull on load** (optional toggle) silently pulls the latest copy when
  you open the app on a device that has already been connected.

Typical multi-device flow: edit on your laptop and `Push`, then open the app on
your phone, `Connect`, and `Pull` (or enable auto-pull). Syncing is
last-write-wins, so push before switching devices to avoid overwriting newer
edits.

### One-time Google Drive setup

Because the site is fully static, Google sign-in happens entirely in the
browser using your own OAuth client. You only do this once.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or
   pick) a project.
2. Enable the **Google Drive API** for that project.
3. Configure the **OAuth consent screen** (External). While it is in "Testing",
   add the Google accounts you will use as **Test users**. The `drive.appdata`
   scope only touches the app's private folder.
4. Create an **OAuth client ID** of type **Web application**.
5. Under **Authorized JavaScript origins**, add the site origin(s) you use, e.g.
   `https://robotaitai.github.io` for GitHub Pages and `http://localhost:3000`
   for local development. (Origins are scheme + host only — no path.)
6. Copy the generated **Client ID** (it looks like
   `xxxxxxxx.apps.googleusercontent.com`). This value is public, not a secret.
7. Either paste it into the `Google OAuth Client ID` field in `Sync Settings`,
   or bake it into the build with the `NEXT_PUBLIC_GOOGLE_CLIENT_ID` environment
   variable (see below). When the env var is set, the UI field is hidden.

The client ID entered in the UI is stored in this browser's `localStorage`, so
forks of this repo can each use their own without committing it.

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

To enable Google Drive sync without typing the client ID into the UI each time,
set the public OAuth client ID as an environment variable (e.g. in `.env.local`
for local dev, or as the `GOOGLE_CLIENT_ID` repository variable consumed by the
Pages workflow):

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
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
