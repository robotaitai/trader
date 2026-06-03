import { normalizeTicker } from "@/lib/security-classification";
import type { Holding, PortfolioSnapshotRow, PriceHistoryPoint } from "@/lib/types";

// Per-ticker daily close series, sorted oldest -> newest.
export function seriesByTicker(priceHistory: PriceHistoryPoint[]) {
  const map = new Map<string, { date: string; close: number }[]>();
  for (const point of priceHistory) {
    const ticker = normalizeTicker(point.ticker);
    const list = map.get(ticker) ?? [];
    list.push({ date: point.date, close: point.close });
    map.set(ticker, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }
  return map;
}

export interface HoldingTrend {
  latestClose: number | null;
  dayChangePct: number | null;
  weekChangePct: number | null;
  spark: number[];
}

// Daily / weekly change and a short sparkline series per ticker.
export function computeHoldingTrends(
  priceHistory: PriceHistoryPoint[],
): Map<string, HoldingTrend> {
  const series = seriesByTicker(priceHistory);
  const trends = new Map<string, HoldingTrend>();

  for (const [ticker, list] of series) {
    const closes = list.map((point) => point.close);
    const latest = closes.at(-1) ?? null;
    const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
    // ~5 trading days back for a one-week change.
    const weekAgo = closes.length >= 6 ? closes[closes.length - 6] : null;

    trends.set(ticker, {
      latestClose: latest,
      dayChangePct:
        latest != null && prev ? ((latest - prev) / prev) * 100 : null,
      weekChangePct:
        latest != null && weekAgo ? ((latest - weekAgo) / weekAgo) * 100 : null,
      spark: closes.slice(-21),
    });
  }

  return trends;
}

export interface PortfolioDayChange {
  change: number;
  pct: number;
  hasData: boolean;
}

// Aggregate today's $ and % move across active holdings.
export function portfolioDayChange(
  holdings: Holding[],
  trends: Map<string, HoldingTrend>,
): PortfolioDayChange {
  let change = 0;
  let previousValue = 0;

  for (const holding of holdings) {
    const trend = trends.get(normalizeTicker(holding.ticker));
    if (!trend || trend.latestClose == null || trend.dayChangePct == null) {
      continue;
    }
    const previousClose = trend.latestClose / (1 + trend.dayChangePct / 100);
    change += holding.quantity * (trend.latestClose - previousClose);
    previousValue += holding.quantity * previousClose;
  }

  return {
    change,
    pct: previousValue ? (change / previousValue) * 100 : 0,
    hasData: previousValue > 0,
  };
}

// Percentage return of a close series from the first point on/after `fromDate`
// to the latest point.
export function rangeReturnPct(
  series: { date: string; close: number }[],
  fromDate?: string,
): number | null {
  if (series.length < 2) return null;
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const startIndex = fromDate
    ? Math.max(
        0,
        sorted.findIndex((point) => point.date >= fromDate),
      )
    : 0;
  const start = sorted[startIndex]?.close;
  const end = sorted.at(-1)?.close;
  if (!start || !end) return null;
  return ((end - start) / start) * 100;
}

function latestClosesByTicker(prices: PriceHistoryPoint[]) {
  const latest = new Map<string, PriceHistoryPoint>();
  for (const point of prices) {
    const ticker = normalizeTicker(point.ticker);
    const existing = latest.get(ticker);
    if (!existing || point.date > existing.date) latest.set(ticker, point);
  }
  return latest;
}

// Apply the latest fetched closes to active snapshot rows (current price,
// value, and unrealized earnings). Shared by import and dashboard refresh.
export function applyLatestCloses(
  snapshotRows: PortfolioSnapshotRow[],
  prices: PriceHistoryPoint[],
): PortfolioSnapshotRow[] {
  const latest = latestClosesByTicker(prices);

  return snapshotRows.map((row) => {
    if (row.status !== "Active") return row;
    const close = latest.get(normalizeTicker(row.ticker));
    if (!close) return row;

    const valueUsd = row.shares * close.close;
    const activeEarning = valueUsd - row.costBasis;
    return {
      ...row,
      currentPrice: close.close,
      valueUsd,
      activeEarning,
      earningsPct: row.costBasis ? (activeEarning / row.costBasis) * 100 : 0,
    };
  });
}
