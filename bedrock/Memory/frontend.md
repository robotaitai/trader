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
- `app/investor-mirror/page.tsx`
- `app/decision-journal/page.tsx`
- `app/sync-settings/page.tsx`

Shared UI lives under `components/`:

- `app-shell.tsx`
- `overview-dashboard.tsx`
- `holdings-table.tsx`
- `performance-lab-view.tsx`
- `exposure-map-view.tsx`
- `investor-mirror-view.tsx`
- `decision-journal-view.tsx`
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

Overview uses the same local analytics primitives as the deeper pages:
monthly performance from `calculateMonthlyPerformance`, contribution rows from
`calculateContributionRows`, exposure roles from `getExposureRole`, and local
risk notes from `generateExposureInsights`. It also has an in-page ticker info
panel rather than a separate route or external company-profile service. Its
value chart should use canonical `YYYY-MM` x-values, range controls, sparse
year-aware tick labels, and full month/year tooltip labels so it scales beyond
one calendar year.

Sectors is no longer a single donut-only view. It has top summary cards,
economic sector aggregation, a horizontal stock-sector weight chart, ETF/fund
sleeve aggregation, a full active allocation donut, and an unclassified-holdings
section when taxonomy coverage is incomplete.

Exposure Map includes a Recharts sector treemap. Rectangle area is active
market value; labels show sector and weight when there is enough room, and the
adjacent detail table shows sector weight, active value, investment/cost basis,
and P&L.

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

## CI

GitHub Actions workflow lives at `.github/workflows/ci.yml`. It runs on pushes
to `main` and pull requests, uses Node 22 with npm cache, installs with
`npm ci`, then runs `npm run lint` and `npm run build`.
