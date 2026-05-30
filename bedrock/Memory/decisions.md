---
note_type: decisions-log
project: trader2
updated: 2026-05-31
---

# Decisions

### 2026-05-31, Keep Phase 1 browser-only

**Decision:** Investor OS Phase 1 uses localStorage and browser-side parsing
only. It does not include backend, authentication, database, Google Sheets sync,
or real AI.

**Why:** The stated product goal is a working local-first dashboard that can be
used immediately and remain safe to publish without private data.

**Impact:** Data access and imports are implemented in client components and
`lib/storage.ts`. Future server features should be explicit new phase work.

**Related files:** `Memory/investor-os.md`, `Memory/local-data.md`

### 2026-05-31, Support both transaction ledgers and portfolio snapshots

**Decision:** The app supports transaction-ledger imports and current portfolio
snapshot imports as separate local data flows.

**Why:** The user's real data is represented as current holdings/status rows,
not only transaction history.

**Impact:** Saved portfolio snapshots override transaction-derived holdings for
dashboard calculations while present. Closed snapshot rows can contribute to
realized P&L.

**Related files:** `Memory/local-data.md`

### 2026-05-31, Keep real portfolio files outside public source

**Decision:** Real portfolio files are stored under ignored paths such as
`private/` and `*.private.*`.

**Why:** The project may become public, but portfolio data must remain private.

**Impact:** `.gitignore` excludes private portfolio files. Agents should not
force-add ignored private files.

**Related files:** `Memory/local-data.md`

### 2026-05-31, Use deterministic local notes before real agents

**Decision:** Performance Lab and Exposure Map use rule-based local insights in
places where future agentic behavior may live.

**Why:** The user asked to "be the agent for now" while the project remains
local-first with no real AI integration.

**Impact:** The app now has agent-like portfolio notes without external API
calls. Future real agents can replace or extend `lib/portfolio-lab.ts`.

**Related files:** `Memory/investor-os.md`, `Memory/local-data.md`

### 2026-05-31, Fetch daily market prices through a local route

**Decision:** Add a local Next route, `/api/price-history`, to fetch Yahoo
Finance daily adjusted-close history for portfolio tickers.

**Why:** Portfolio performance over time cannot be calculated professionally
from only current prices. The user asked for an online query path to calculate
day-by-day/month-by-month performance.

**Impact:** The app remains local-first for persistence, but now uses an online
market data source on demand. Fetched history is stored in localStorage and used
by Performance Lab.

**Related files:** `Memory/local-data.md`, `Memory/frontend.md`
