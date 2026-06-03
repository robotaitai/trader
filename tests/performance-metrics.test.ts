import { describe, expect, it } from "vitest";
import {
  applyLatestCloses,
  computeHoldingTrends,
  portfolioDayChange,
  rangeReturnPct,
} from "@/lib/performance-metrics";
import type { Holding, PortfolioSnapshotRow, PriceHistoryPoint } from "@/lib/types";

const history: PriceHistoryPoint[] = [
  { ticker: "AAPL", date: "2026-01-01", close: 100 },
  { ticker: "AAPL", date: "2026-01-02", close: 102 },
  { ticker: "AAPL", date: "2026-01-03", close: 101 },
  { ticker: "AAPL", date: "2026-01-04", close: 103 },
  { ticker: "AAPL", date: "2026-01-05", close: 104 },
  { ticker: "AAPL", date: "2026-01-06", close: 110 }, // latest
];

describe("computeHoldingTrends", () => {
  it("computes day and week change from the close series", () => {
    const trend = computeHoldingTrends(history).get("AAPL")!;
    expect(trend.latestClose).toBe(110);
    // day: 110 vs 104
    expect(trend.dayChangePct).toBeCloseTo(((110 - 104) / 104) * 100, 5);
    // week: 110 vs the close 5 entries back (100)
    expect(trend.weekChangePct).toBeCloseTo(((110 - 100) / 100) * 100, 5);
    expect(trend.spark.at(-1)).toBe(110);
  });
});

describe("portfolioDayChange", () => {
  it("aggregates today's move across holdings", () => {
    const holdings = [{ ticker: "AAPL", quantity: 10 } as Holding];
    const result = portfolioDayChange(holdings, computeHoldingTrends(history));
    expect(result.hasData).toBe(true);
    // 10 shares * (110 - 104) = 60
    expect(result.change).toBeCloseTo(60, 5);
  });
});

describe("rangeReturnPct", () => {
  it("returns percentage from first point on/after the cutoff", () => {
    const series = history.map((p) => ({ date: p.date, close: p.close }));
    expect(rangeReturnPct(series, "2026-01-03")).toBeCloseTo(
      ((110 - 101) / 101) * 100,
      5,
    );
    expect(rangeReturnPct([{ date: "x", close: 1 }])).toBeNull();
  });
});

describe("applyLatestCloses", () => {
  it("updates active rows with the latest close and recomputed value", () => {
    const rows: PortfolioSnapshotRow[] = [
      {
        id: "1",
        ticker: "AAPL",
        securityType: "Stock",
        shares: 10,
        purchasePrice: 90,
        currentPrice: 90,
        valueUsd: 900,
        costBasis: 900,
        earningsPct: 0,
        status: "Active",
      },
    ];
    const [updated] = applyLatestCloses(rows, history);
    expect(updated.currentPrice).toBe(110);
    expect(updated.valueUsd).toBe(1100);
    expect(updated.activeEarning).toBe(200);
  });
});
