---
note_type: memory-branch
project: trader2
updated: 2026-05-31
---

# Frontend

## Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- Recharts
- TanStack Table
- SheetJS/xlsx
- lucide-react
- Local shadcn-style UI primitives

## Structure

Routes live under `app/`:

- `app/page.tsx` redirects to `/overview`
- `app/api/price-history/route.ts`
- `app/overview/page.tsx`
- `app/holdings/page.tsx`
- `app/performance-lab/page.tsx`
- `app/exposure-map/page.tsx`
- `app/sectors/page.tsx`
- `app/sync-settings/page.tsx`

Shared UI lives under `components/`:

- `app-shell.tsx`
- `overview-dashboard.tsx`
- `holdings-table.tsx`
- `performance-lab-view.tsx`
- `exposure-map-view.tsx`
- `insight-list.tsx`
- `sector-view.tsx`
- `page-header.tsx`
- `components/ui/*`

Shared domain utilities live under `lib/`.

Security classification lives in `lib/security-classification.ts`. Exposure Map
uses professional sector labels and portfolio roles, not raw asset types such as
Stock/ETF or generic labels such as Material.

Performance Lab has a `Fetch daily prices` action that calls the local
`/api/price-history` route. The x-axis for monthly performance should use
readable month labels such as `Jun 2025`, not raw `YYYY-MM` ticks.
The monthly chart shows a source badge: `Estimated` before daily prices are
fetched, and `Daily prices` after fetched adjusted-close history is available.

## Styling

Design direction is white, gray, and black with restrained green/red P&L color.
The app uses dense readable tables and cards with modest radius. Charts disable
Recharts animation so rendered chart elements are visible during automated and
headless checks.

## Commands

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

Lint uses ESLint CLI through `eslint.config.mjs`; avoid `next lint` because it
is deprecated and can become interactive in new projects.
