// Builds the static price-history dataset the app reads at runtime, so the
// live market API is only needed for tickers that are NOT bundled here.
//
// Data source: Yahoo Finance chart endpoint (primary) with Stooq as a fallback.
// Run from Node (no browser CORS) it can be fetched in bulk. Output is one small
// JSON file per ticker under public/data/prices/, plus an index.json.
//
// Usage:
//   node scripts/build-price-history.mjs                 # tickers from price-tickers.txt
//   node scripts/build-price-history.mjs NVDA SMCI       # plus extra symbols

import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT_DIR = "public/data/prices";
const TICKERS_FILE = "scripts/price-tickers.txt";
const YEARS = 5;
const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

function normalize(ticker) {
  return ticker
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/[^A-Z0-9.-]/g, "");
}

// Yahoo uses a dash for class shares (BRK.B -> BRK-B).
function yahooSymbol(ticker) {
  return ticker.replace(/\./g, "-");
}

// US equities/ETFs on Stooq use the ".us" suffix; dots become dashes.
function stooqSymbol(ticker) {
  return `${ticker.toLowerCase().replace(/\./g, "-")}.us`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchYahoo(ticker, attempt = 0) {
  const period2 = Math.floor(Date.now() / 1000) + 86400;
  const period1 = period2 - YEARS * 366 * 86400;
  const host = YAHOO_HOSTS[attempt % YAHOO_HOSTS.length];
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
    yahooSymbol(ticker),
  )}?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; investor-os price builder; +https://github.com)",
      accept: "application/json",
    },
  });
  if (response.status === 429) throw new Error("rate-limited");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const adjusted = result?.indicators?.adjclose?.[0]?.adjclose;
  const close = result?.indicators?.quote?.[0]?.close ?? [];
  const prices = adjusted ?? close;

  const closes = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const value = prices[i];
    if (typeof value === "number" && Number.isFinite(value)) {
      closes.push([
        new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        Math.round(value * 10000) / 10000,
      ]);
    }
  }
  if (closes.length === 0) throw new Error("empty series");
  return closes;
}

async function fetchStooq(ticker) {
  const compact = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - YEARS);
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol(ticker)}&d1=${compact(
    from,
  )}&d2=${compact(to)}&i=d`;

  const response = await fetch(url, {
    headers: { "user-agent": "investor-os price builder" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2 || !/^Date,/i.test(lines[0])) throw new Error("no data");

  const closes = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    const close = Number(parts[4]);
    if (parts[0] && Number.isFinite(close)) closes.push([parts[0], close]);
  }
  if (closes.length === 0) throw new Error("empty series");
  return closes;
}

// Yahoo primary (with a couple of retries for 429s), Stooq fallback.
async function fetchCloses(ticker) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchYahoo(ticker, attempt);
    } catch (error) {
      if (attempt < 2) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      try {
        return await fetchStooq(ticker);
      } catch {
        throw error;
      }
    }
  }
  throw new Error("unreachable");
}

async function main() {
  const listed = (await readFile(TICKERS_FILE, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const extra = process.argv.slice(2);
  const tickers = Array.from(
    new Set([...listed, ...extra].map(normalize).filter(Boolean)),
  ).sort();

  await mkdir(OUT_DIR, { recursive: true });

  const covered = [];
  const failed = [];
  for (const ticker of tickers) {
    try {
      const closes = await fetchCloses(ticker);
      await writeFile(
        `${OUT_DIR}/${ticker}.json`,
        JSON.stringify({
          ticker,
          source: "yahoo",
          from: closes[0][0],
          to: closes[closes.length - 1][0],
          closes,
        }),
      );
      covered.push(ticker);
      console.log(`ok   ${ticker} (${closes.length} days)`);
    } catch (error) {
      failed.push(ticker);
      console.warn(`skip ${ticker}: ${error.message}`);
    }
    await sleep(250);
  }

  await writeFile(
    `${OUT_DIR}/index.json`,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      years: YEARS,
      covered: covered.sort(),
      failed: failed.sort(),
    }),
  );
  console.log(`\nDone. ${covered.length} covered, ${failed.length} failed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
