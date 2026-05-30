import { NextResponse } from "next/server";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }>;
    error?: { description?: string };
  };
};

function toUnix(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

function formatDate(timestampSeconds: number) {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
}

async function fetchYahooHistory(ticker: string, from: string, to: string) {
  const period1 = toUnix(from);
  const period2 = toUnix(to) + 24 * 60 * 60;
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
  );
  url.searchParams.set("period1", String(period1));
  url.searchParams.set("period2", String(period2));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");
  url.searchParams.set("includeAdjustedClose", "true");

  const response = await fetch(url, {
    headers: {
      "user-agent": "Investor OS local portfolio analytics",
    },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned ${response.status}`);
  }

  const data = (await response.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const adjusted = result?.indicators?.adjclose?.[0]?.adjclose;
  const close = result?.indicators?.quote?.[0]?.close ?? [];
  const prices = adjusted ?? close;

  return timestamps
    .map((timestamp, index) => ({
      ticker,
      date: formatDate(timestamp),
      close: prices[index],
    }))
    .filter(
      (point): point is { ticker: string; date: string; close: number } =>
        typeof point.close === "number" && Number.isFinite(point.close),
    );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickers = (searchParams.get("tickers") ?? "")
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);
  const from = searchParams.get("from") ?? "2020-01-01";
  const to = searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  if (!tickers.length) {
    return NextResponse.json({ error: "No tickers provided." }, { status: 400 });
  }

  const results = await Promise.allSettled(
    tickers.map((ticker) => fetchYahooHistory(ticker, from, to)),
  );
  const prices = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const errors = results
    .map((result, index) =>
      result.status === "rejected"
        ? { ticker: tickers[index], error: result.reason instanceof Error ? result.reason.message : "Unknown error" }
        : null,
    )
    .filter(Boolean);

  return NextResponse.json({
    source: "Yahoo Finance chart endpoint",
    prices,
    errors,
  });
}
