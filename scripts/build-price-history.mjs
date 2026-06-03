// Builds the static price-history dataset the app reads at runtime, so the
// live market API is only needed for tickers that are NOT bundled here.
//
// Data source: Stooq daily CSV. It is keyless and, run from Node (no browser
// CORS), can be fetched in bulk. Output is one small JSON file per ticker under
// public/data/prices/, plus an index.json describing coverage.
//
// Usage:
//   node scripts/build-price-history.mjs                 # tickers from price-tickers.txt
//   node scripts/build-price-history.mjs NVDA SMCI       # plus extra symbols

import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT_DIR = "public/data/prices";
const TICKERS_FILE = "scripts/price-tickers.txt";
const YEARS = 5;

function normalize(ticker) {
  return ticker
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/[^A-Z0-9.-]/g, "");
}

// US equities/ETFs on Stooq use the ".us" suffix; dots become dashes (BRK.B -> brk-b).
function stooqSymbol(ticker) {
  return `${ticker.toLowerCase().replace(/\./g, "-")}.us`;
}

function compactDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchCloses(ticker) {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - YEARS);
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol(ticker)}&d1=${compactDate(from)}&d2=${compactDate(to)}&i=d`;

  const response = await fetch(url, {
    headers: { "user-agent": "investor-os price builder" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2 || !/^Date,/i.test(lines[0])) {
    throw new Error("no data returned");
  }

  const closes = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    const date = parts[0];
    const close = Number(parts[4]);
    if (date && Number.isFinite(close)) closes.push([date, close]);
  }
  if (closes.length === 0) throw new Error("empty series");
  return closes;
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
          source: "stooq",
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
    // Be polite to the free source.
    await new Promise((resolve) => setTimeout(resolve, 300));
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
