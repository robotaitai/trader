---
note_type: project-overview
project: trader2
updated: 2026-05-31
---

# Project

## What this project is

`trader2` is a Next.js local-first portfolio analytics app named Investor OS.
It is a private investor cockpit intended to be publishable as a public codebase
without committing the user's real portfolio data.

## Current product direction

Phase 1 is a browser-only portfolio dashboard. It imports stock transaction
ledgers or current portfolio status snapshots from CSV/TSV/XLSX, persists them
in `localStorage`, and calculates basic holdings, sector exposure, portfolio
summary, concentration, and winners/losers.

The app intentionally has no backend, auth, database, Google Sheets sync, or
real AI integration yet.

## How to navigate this memory

The Memory folder is project-shaped. Branches should match the real system,
product, or domain areas.

- `Memory/investor-os.md` covers the product surface and implemented pages.
- `Memory/local-data.md` covers domain types, persistence, imports, and private
  portfolio-data handling.
- `Memory/frontend.md` covers UI structure, styling, and commands.
- `Memory/decisions.md` records durable implementation decisions.

## Important context

- Source is a Next.js App Router app with TypeScript, Tailwind CSS, Recharts,
  TanStack Table, SheetJS/xlsx, lucide-react icons, and local shadcn-style UI
  primitives.
- Main routes are `/overview`, `/holdings`, `/performance-lab`,
  `/exposure-map`, `/sectors`, `/investor-mirror`, `/decision-journal`, and
  `/sync-settings`. `/` redirects to `/overview`.
- Data is local-only. `lib/storage.ts` reads and writes browser `localStorage`.
- Demo data in `lib/mock-data.ts` is available only by explicit user action;
  the app no longer auto-seeds fake holdings as the active portfolio.
- `private/` and `*.private.*` files are ignored by `.gitignore` for local real
  portfolio files. Do not force-add those files when preparing a public repo.
- The repo has Git state; do not force-add ignored private portfolio files.
