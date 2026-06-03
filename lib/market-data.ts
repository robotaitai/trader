"use client";

import { normalizeTicker } from "@/lib/security-classification";
import type { PriceHistoryPoint } from "@/lib/types";

// Client-side market data. The site is static (GitHub Pages), so there is no
// server to proxy Yahoo Finance. We fetch the public Yahoo chart endpoint
// directly from the browser, falling back to public CORS proxies when the
// direct request is blocked by CORS. Only ticker symbols leave the device.

type UrlWrapper = (url: string) => string;

const PROXIES: UrlWrapper[] = [
  // Try direct first (works on hosts where CORS is permitted / dev), then
  // fall back to public CORS proxies.
  (url) => url,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }>;
  };
}

function toUnix(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

function buildChartUrl(ticker: string, from: string, to: string) {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
  );
  url.searchParams.set("period1", String(toUnix(from)));
  url.searchParams.set("period2", String(toUnix(to) + 24 * 60 * 60));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("includeAdjustedClose", "true");
  return url.toString();
}

function parseChart(ticker: string, data: YahooChartResponse): PriceHistoryPoint[] {
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const adjusted = result?.indicators?.adjclose?.[0]?.adjclose;
  const close = result?.indicators?.quote?.[0]?.close ?? [];
  const prices = adjusted ?? close;
  const normalized = normalizeTicker(ticker);

  return timestamps
    .map((timestamp, index) => ({
      ticker: normalized,
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close: prices[index] ?? null,
    }))
    .filter(
      (point): point is PriceHistoryPoint =>
        typeof point.close === "number" && Number.isFinite(point.close),
    );
}

async function fetchOne(
  ticker: string,
  from: string,
  to: string,
): Promise<PriceHistoryPoint[]> {
  const target = buildChartUrl(ticker, from, to);
  for (const wrap of PROXIES) {
    try {
      const response = await fetch(wrap(target));
      if (!response.ok) continue;
      const data = (await response.json()) as YahooChartResponse;
      const points = parseChart(ticker, data);
      if (points.length > 0) return points;
    } catch {
      // Try the next proxy.
    }
  }
  throw new Error(ticker);
}

// Run async jobs with a small concurrency cap so we are gentle on the proxies.
async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export interface DailyClosesResult {
  prices: PriceHistoryPoint[];
  failed: string[];
}

// Fetch daily closes for the given tickers between two dates (YYYY-MM-DD).
export async function fetchDailyCloses(
  tickers: string[],
  from: string,
  to: string = new Date().toISOString().slice(0, 10),
  onProgress?: (done: number, total: number) => void,
): Promise<DailyClosesResult> {
  const unique = Array.from(
    new Set(tickers.map(normalizeTicker).filter(Boolean)),
  );
  if (unique.length === 0) return { prices: [], failed: [] };

  let done = 0;
  const settled = await pool(unique, 5, async (ticker) => {
    const points = await fetchOne(ticker, from, to);
    done += 1;
    onProgress?.(done, unique.length);
    return points;
  });

  const prices: PriceHistoryPoint[] = [];
  const failed: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") prices.push(...result.value);
    else failed.push(unique[index]);
  });

  return { prices, failed };
}

// ---------------------------------------------------------------------------
// Twelve Data (optional, user-supplied free API key). CORS-enabled, so it is
// fetched directly with no proxy — more reliable than the keyless path. Used
// only for tickers that are not in the bundled dataset.
// ---------------------------------------------------------------------------
const TWELVE_DATA_KEY = "investor-os.twelvedata.key";

export function getTwelveDataKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TWELVE_DATA_KEY) ?? "";
}

export function setTwelveDataKey(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TWELVE_DATA_KEY, value.trim());
}

interface TwelveDataSeries {
  status?: string;
  values?: Array<{ datetime: string; close: string }>;
}

function parseTwelveSeries(
  ticker: string,
  series: TwelveDataSeries | undefined,
): PriceHistoryPoint[] {
  if (!series?.values) return [];
  const normalized = normalizeTicker(ticker);
  return series.values
    .map((value) => ({
      ticker: normalized,
      date: value.datetime.slice(0, 10),
      close: Number(value.close),
    }))
    .filter((point) => Number.isFinite(point.close));
}

export async function fetchTwelveData(
  tickers: string[],
  from: string,
  apiKey: string,
): Promise<DailyClosesResult> {
  const unique = Array.from(
    new Set(tickers.map(normalizeTicker).filter(Boolean)),
  );
  if (unique.length === 0 || !apiKey) return { prices: [], failed: unique };

  const prices: PriceHistoryPoint[] = [];
  const failed: string[] = [];

  // Free tier allows ~8 symbols/minute; request in small batches.
  for (let i = 0; i < unique.length; i += 8) {
    const batch = unique.slice(i, i + 8);
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1500));

    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", batch.join(","));
    url.searchParams.set("interval", "1day");
    url.searchParams.set("start_date", from);
    url.searchParams.set("outputsize", "5000");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("format", "JSON");

    try {
      const response = await fetch(url.toString());
      const data = (await response.json()) as
        | TwelveDataSeries
        | Record<string, TwelveDataSeries>;

      if (batch.length === 1) {
        const points = parseTwelveSeries(batch[0], data as TwelveDataSeries);
        if (points.length) prices.push(...points);
        else failed.push(batch[0]);
      } else {
        const map = data as Record<string, TwelveDataSeries>;
        for (const ticker of batch) {
          const points = parseTwelveSeries(ticker, map[ticker]);
          if (points.length) prices.push(...points);
          else failed.push(ticker);
        }
      }
    } catch {
      failed.push(...batch);
    }
  }

  return { prices, failed };
}
