"use client";

import { useMemo, useState } from "react";
import { Info, X } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  SortableTableHead,
  useSortableData,
} from "@/components/sortable-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockHistoricalValues } from "@/lib/mock-data";
import {
  calculateContributionRows,
  calculateMonthlyPerformance,
  generateExposureInsights,
  getExposureRole,
} from "@/lib/portfolio-lab";
import { normalizeTicker } from "@/lib/security-classification";
import { usePortfolioData } from "@/lib/storage";
import type {
  Holding,
  PortfolioSnapshotRow,
  PriceHistoryPoint,
  Transaction,
} from "@/lib/types";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatPct,
  formatNumber,
  pnlClass,
} from "@/lib/utils";

const sectorColors = [
  "#111827",
  "#374151",
  "#6b7280",
  "#10b981",
  "#ef4444",
  "#9ca3af",
  "#d1d5db",
  "#030712",
];

type ValueRange = "6M" | "1Y" | "3Y" | "ALL";
type PerformanceGranularity = "D" | "W" | "M" | "Q" | "Y";
type PerformanceView = "value" | "return" | "candles";

type ValueHistoryPoint = {
  month: string;
  label: string;
  value: number;
};

type PerformancePeriod = {
  period: string;
  sortDate: string;
  label: string;
  shortLabel: string;
  dataSource: "estimated" | "daily-prices" | "mock";
  startingValue: number;
  endingValue: number;
  highValue: number;
  lowValue: number;
  netFlow: number;
  gainLoss: number;
  returnPct: number;
};

const valueRangeOptions: Array<{ label: ValueRange; months: number | null }> = [
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "3Y", months: 36 },
  { label: "ALL", months: null },
];

const granularityOptions: Array<{
  label: string;
  value: PerformanceGranularity;
}> = [
  { label: "Daily", value: "D" },
  { label: "Weekly", value: "W" },
  { label: "Monthly", value: "M" },
  { label: "Quarterly", value: "Q" },
  { label: "Yearly", value: "Y" },
];

const performanceViewOptions: Array<{ label: string; value: PerformanceView }> = [
  { label: "Value", value: "value" },
  { label: "Return %", value: "return" },
  { label: "Candles", value: "candles" },
];

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
}

function dateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function shortDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeekKey(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return dateKey(date);
}

function addMonthsToDate(value: string, months: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setMonth(date.getMonth() - months);
  return dateKey(date);
}

function filterByRange(points: PerformancePeriod[], range: ValueRange) {
  const option = valueRangeOptions.find((item) => item.label === range);
  if (!option?.months) return points;
  const lastDate = points[points.length - 1]?.sortDate;
  if (!lastDate) return points;
  const cutoff = addMonthsToDate(lastDate, option.months);
  return points.filter((point) => point.sortDate >= cutoff);
}

function compactTickInterval(pointCount: number) {
  if (pointCount <= 8) return 0;
  if (pointCount <= 18) return 1;
  if (pointCount <= 36) return 2;
  return Math.ceil(pointCount / 12);
}

function formatAxisCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(Math.abs(value) >= 10_000_000 ? 0 : 1)}M`;
  }
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function periodKey(sortDate: string, granularity: PerformanceGranularity) {
  if (granularity === "D") return sortDate;
  if (granularity === "W") return startOfWeekKey(sortDate);
  if (granularity === "M") return sortDate.slice(0, 7);

  const year = sortDate.slice(0, 4);
  if (granularity === "Y") return year;

  const quarter = Math.ceil(Number(sortDate.slice(5, 7)) / 3);
  return `${year}-Q${quarter}`;
}

function periodLabels(key: string, granularity: PerformanceGranularity) {
  if (granularity === "D") {
    return {
      label: dateLabel(key),
      shortLabel: shortDateLabel(key),
    };
  }

  if (granularity === "W") {
    return {
      label: `Week of ${dateLabel(key)}`,
      shortLabel: shortDateLabel(key),
    };
  }

  if (granularity === "M") {
    return {
      label: monthLabel(key),
      shortLabel: monthLabel(key),
    };
  }

  if (granularity === "Y") {
    return { label: key, shortLabel: key };
  }

  const [year, quarter] = key.split("-Q");
  return {
    label: `Q${quarter} ${year}`,
    shortLabel: `Q${quarter} ${year.slice(2)}`,
  };
}

function buildMockPerformanceHistory(valueHistory: ValueHistoryPoint[]) {
  return valueHistory.map((point, index) => {
    const previous = valueHistory[index - 1]?.value ?? point.value;
    const gainLoss = point.value - previous;

    return {
      period: point.month,
      sortDate: `${point.month}-01`,
      label: point.label,
      shortLabel: point.label,
      dataSource: "mock" as const,
      startingValue: previous,
      endingValue: point.value,
      highValue: Math.max(previous, point.value),
      lowValue: Math.min(previous, point.value),
      netFlow: 0,
      gainLoss,
      returnPct: previous ? (gainLoss / previous) * 100 : 0,
    };
  });
}

function transactionCashFlow(transaction: Transaction) {
  const amount = Math.abs((transaction.quantity || 1) * transaction.price);

  if (transaction.action === "BUY" || transaction.action === "DEPOSIT") {
    return amount + transaction.fees;
  }

  if (transaction.action === "SELL" || transaction.action === "WITHDRAWAL") {
    return -(amount - transaction.fees);
  }

  if (transaction.action === "FEE" || transaction.action === "TAX") {
    return amount;
  }

  return 0;
}

function buildDailyPerformanceHistory(
  transactions: Transaction[],
  snapshotRows: PortfolioSnapshotRow[],
  priceHistory: PriceHistoryPoint[],
) {
  if (priceHistory.length === 0) return [];

  const priceRows = [...priceHistory]
    .map((point) => ({
      ...point,
      ticker: normalizeTicker(point.ticker),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const dates = Array.from(new Set(priceRows.map((point) => point.date))).sort();
  const dailyPrices = new Map<string, Record<string, number>>();
  const runningPrices: Record<string, number> = {};

  for (const date of dates) {
    for (const row of priceRows.filter((point) => point.date === date)) {
      runningPrices[row.ticker] = row.close;
    }
    dailyPrices.set(date, { ...runningPrices });
  }

  const parsedTransactions = transactions
    .map((transaction) => ({
      ...transaction,
      ticker: normalizeTicker(transaction.ticker),
      parsedDate: transaction.date,
    }))
    .filter((transaction) => transaction.parsedDate);
  const activeSnapshotRows = snapshotRows
    .filter((row) => row.status === "Active")
    .map((row) => ({
      ...row,
      ticker: normalizeTicker(row.ticker),
    }));
  const useTransactions = parsedTransactions.length > 0;
  const points: PerformancePeriod[] = [];

  function positionsAt(date: string) {
    const positions: Record<string, number> = {};

    if (useTransactions) {
      for (const transaction of parsedTransactions) {
        if (transaction.parsedDate > date) continue;

        if (transaction.action === "BUY") {
          positions[transaction.ticker] =
            (positions[transaction.ticker] ?? 0) + transaction.quantity;
        }

        if (transaction.action === "SELL") {
          positions[transaction.ticker] = Math.max(
            (positions[transaction.ticker] ?? 0) - transaction.quantity,
            0,
          );
        }
      }
      return positions;
    }

    for (const row of activeSnapshotRows) {
      if (row.purchaseDate && row.purchaseDate > date) continue;
      positions[row.ticker] = (positions[row.ticker] ?? 0) + row.shares;
    }

    return positions;
  }

  function valueAt(date: string) {
    const prices = dailyPrices.get(date) ?? {};
    return Object.entries(positionsAt(date)).reduce(
      (sum, [ticker, quantity]) => sum + quantity * (prices[ticker] ?? 0),
      0,
    );
  }

  function netFlowOn(date: string) {
    if (useTransactions) {
      return parsedTransactions
        .filter((transaction) => transaction.parsedDate === date)
        .reduce((sum, transaction) => sum + transactionCashFlow(transaction), 0);
    }

    return activeSnapshotRows
      .filter((row) => row.purchaseDate === date)
      .reduce((sum, row) => sum + row.costBasis, 0);
  }

  for (const date of dates) {
    const endingValue = valueAt(date);
    if (endingValue === 0) continue;

    const previous = points.at(-1);
    const startingValue = previous?.endingValue ?? endingValue;
    const netFlow = previous ? netFlowOn(date) : 0;
    const gainLoss = endingValue - startingValue - netFlow;
    const capitalBase = startingValue + Math.max(netFlow, 0);

    points.push({
      period: date,
      sortDate: date,
      label: dateLabel(date),
      shortLabel: shortDateLabel(date),
      dataSource: "daily-prices",
      startingValue,
      endingValue,
      highValue: Math.max(startingValue, endingValue),
      lowValue: Math.min(startingValue, endingValue),
      netFlow,
      gainLoss,
      returnPct: capitalBase ? (gainLoss / capitalBase) * 100 : 0,
    });
  }

  return points;
}

function aggregatePerformancePeriods(
  periods: PerformancePeriod[],
  granularity: PerformanceGranularity,
): PerformancePeriod[] {
  const grouped = new Map<string, PerformancePeriod[]>();

  for (const period of periods) {
    const key = periodKey(period.sortDate, granularity);
    grouped.set(key, [...(grouped.get(key) ?? []), period]);
  }

  return Array.from(grouped.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => a.period.localeCompare(b.period));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const netFlow = sorted.reduce((sum, item) => sum + item.netFlow, 0);
    const gainLoss = last.endingValue - first.startingValue - netFlow;
    const capitalBase = first.startingValue + Math.max(netFlow, 0);
    const labels = periodLabels(key, granularity);
    const dataSource: PerformancePeriod["dataSource"] = sorted.some(
      (item) => item.dataSource === "daily-prices",
    )
      ? "daily-prices"
      : sorted.some((item) => item.dataSource === "estimated")
        ? "estimated"
        : "mock";

    return {
      ...labels,
      period: key,
      sortDate: first.sortDate,
      dataSource,
      startingValue: first.startingValue,
      endingValue: last.endingValue,
      highValue: Math.max(
        ...sorted.flatMap((item) => [item.highValue, item.startingValue, item.endingValue]),
      ),
      lowValue: Math.min(
        ...sorted.flatMap((item) => [item.lowValue, item.startingValue, item.endingValue]),
      ),
      netFlow,
      gainLoss,
      returnPct: capitalBase ? (gainLoss / capitalBase) * 100 : 0,
    };
  });
}

function LegendItem({
  color,
  label,
  detail,
}: {
  color: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-white px-3 py-2">
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[11px] leading-4 text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

function CandlePerformanceChart({ data }: { data: PerformancePeriod[] }) {
  const width = 920;
  const height = 330;
  const padding = { top: 18, right: 24, bottom: 46, left: 74 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = data.flatMap((item) => [
    item.startingValue,
    item.endingValue,
    item.highValue,
    item.lowValue,
  ]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(rawMax - rawMin, rawMax * 0.05, 1);
  const min = Math.max(0, rawMin - spread * 0.12);
  const max = rawMax + spread * 0.12;
  const yScale = (value: number) =>
    padding.top + ((max - value) / (max - min)) * plotHeight;
  const xStep = plotWidth / Math.max(data.length, 1);
  const candleWidth = Math.max(7, Math.min(28, xStep * 0.38));
  const ticks = [max, max - (max - min) / 3, max - ((max - min) * 2) / 3, min];

  return (
    <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img">
      {ticks.map((tick) => {
        const y = yScale(tick);
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
            />
            <text
              x={padding.left - 12}
              y={y + 4}
              textAnchor="end"
              className="fill-gray-500 text-[11px]"
            >
              {formatAxisCurrency(tick)}
            </text>
          </g>
        );
      })}
      {data.map((item, index) => {
        const x = padding.left + xStep * index + xStep / 2;
        const openY = yScale(item.startingValue);
        const closeY = yScale(item.endingValue);
        const highY = yScale(item.highValue);
        const lowY = yScale(item.lowValue);
        const up = item.endingValue >= item.startingValue;
        const color = up ? "#047857" : "#dc2626";
        const bodyY = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 3);
        const shouldShowLabel =
          data.length <= 12 ||
          index === 0 ||
          index === data.length - 1 ||
          index % Math.ceil(data.length / 8) === 0;

        return (
          <g key={item.period}>
            <title>
              {`${item.label}: open ${formatCurrency(item.startingValue)}, close ${formatCurrency(item.endingValue)}, return ${formatPct(item.returnPct)}, net flow ${formatCurrency(item.netFlow)}`}
            </title>
            <line
              x1={x}
              x2={x}
              y1={highY}
              y2={lowY}
              stroke={color}
              strokeWidth={1.5}
            />
            <rect
              x={x - candleWidth / 2}
              y={bodyY}
              width={candleWidth}
              height={bodyHeight}
              rx={2}
              fill={up ? "#ecfdf5" : "#fef2f2"}
              stroke={color}
              strokeWidth={1.6}
            />
            {shouldShowLabel ? (
              <text
                x={x}
                y={height - 18}
                textAnchor="middle"
                className="fill-gray-500 text-[11px]"
              >
                {item.shortLabel}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "negative" | "warning";
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={[
            "text-2xl font-semibold tracking-tight",
            tone === "positive" ? "text-emerald-700" : "",
            tone === "negative" ? "text-red-700" : "",
            tone === "warning" ? "text-amber-700" : "",
          ].join(" ")}
        >
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-gray-50 p-6 text-sm leading-5 text-muted-foreground">
      {children}
    </div>
  );
}

function TickerInfoPanel({
  holding,
  onClose,
}: {
  holding: Holding;
  onClose: () => void;
}) {
  const role = getExposureRole(holding);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-6">
      <div className="w-full max-w-2xl rounded-t-xl bg-white shadow-xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {holding.ticker}
              </h2>
              <Badge variant="outline">{holding.exchange}</Badge>
              <Badge variant="outline">{holding.currency}</Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {holding.name}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close ticker info">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="rounded-md border bg-gray-50 p-4 text-sm leading-6">
            <div className="font-medium">What this ticker means here</div>
            <p className="mt-1 text-muted-foreground">
              {holding.ticker} is the portfolio symbol for {holding.name}. In
              this app it is classified as {holding.sector} and currently acts
              as a {role.toLowerCase()} based on its weight and unrealized
              return.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Weight</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {holding.weightPct.toFixed(2)}%
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Market Value</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrencyPrecise(holding.marketValue)}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Unrealized Return</div>
              <div className={`mt-1 text-lg font-semibold tabular-nums ${pnlClass(holding.unrealizedPnlPct)}`}>
                {formatPct(holding.unrealizedPnlPct)}
              </div>
            </div>
          </div>

          <Table className="text-xs">
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">Quantity</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(holding.quantity, 6)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Average cost</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyPrecise(holding.avgCost)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Current price</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyPrecise(holding.currentPrice)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Cost basis</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyPrecise(holding.costBasis)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Unrealized P&L</TableCell>
                <TableCell className={`text-right tabular-nums ${pnlClass(holding.unrealizedPnl)}`}>
                  {formatCurrencyPrecise(holding.unrealizedPnl)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">First buy</TableCell>
                <TableCell className="text-right">{holding.firstBuyDate || "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Last action</TableCell>
                <TableCell className="text-right">{holding.lastActionDate || "-"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export function OverviewDashboard() {
  const {
    closedPositions,
    currentPrices,
    dataSource,
    holdings,
    portfolioSnapshot,
    priceHistory,
    sectorExposure,
    summary,
    topWinnersLosers,
    transactions,
  } = usePortfolioData();
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [valueRange, setValueRange] = useState<ValueRange>("1Y");
  const [performanceGranularity, setPerformanceGranularity] =
    useState<PerformanceGranularity>("M");
  const [performanceView, setPerformanceView] =
    useState<PerformanceView>("value");

  const monthlyPerformance = useMemo(
    () =>
      calculateMonthlyPerformance(
        transactions,
        portfolioSnapshot,
        currentPrices,
        priceHistory,
      ),
    [transactions, portfolioSnapshot, currentPrices, priceHistory],
  );
  const valueHistory = useMemo<ValueHistoryPoint[]>(() => {
    if (monthlyPerformance.length > 0) {
      return monthlyPerformance.map((point) => ({
        month: point.month,
        label: point.label,
        value: Math.round(point.endingValue),
      }));
    }

    const currentYear = new Date().getFullYear();
    return mockHistoricalValues.map((point, index, items) => {
      const scale =
        items[items.length - 1].value === 0
          ? 1
          : summary.portfolioValue / items[items.length - 1].value;
      const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;

      return {
        month,
        label: monthLabel(month),
        value: Math.round(point.value * scale),
      };
    });
  }, [monthlyPerformance, summary.portfolioValue]);
  const monthlyPerformanceHistory = useMemo<PerformancePeriod[]>(() => {
    if (monthlyPerformance.length > 0) {
      return monthlyPerformance.map((point) => ({
        period: point.month,
        sortDate: `${point.month}-01`,
        label: point.label,
        shortLabel: point.label,
        dataSource: point.dataSource,
        startingValue: point.startingValue,
        endingValue: point.endingValue,
        highValue: Math.max(point.startingValue, point.endingValue),
        lowValue: Math.min(point.startingValue, point.endingValue),
        netFlow: point.netFlow,
        gainLoss: point.gainLoss,
        returnPct: point.returnPct,
      }));
    }

    return buildMockPerformanceHistory(valueHistory);
  }, [monthlyPerformance, valueHistory]);
  const dailyPerformanceHistory = useMemo(
    () =>
      buildDailyPerformanceHistory(transactions, portfolioSnapshot, priceHistory),
    [transactions, portfolioSnapshot, priceHistory],
  );
  const hasDailyPerformance = dailyPerformanceHistory.length > 0;
  const effectiveGranularity =
    hasDailyPerformance ||
    (performanceGranularity !== "D" && performanceGranularity !== "W")
      ? performanceGranularity
      : "M";
  const performanceBaseHistory =
    hasDailyPerformance &&
    (effectiveGranularity === "D" || effectiveGranularity === "W")
      ? dailyPerformanceHistory
      : monthlyPerformanceHistory;
  const visiblePerformancePeriods = useMemo(
    () =>
      aggregatePerformancePeriods(
        filterByRange(performanceBaseHistory, valueRange),
        effectiveGranularity,
      ),
    [performanceBaseHistory, valueRange, effectiveGranularity],
  );
  const firstRangeValue = visiblePerformancePeriods
    .map((point) => point.startingValue || point.endingValue)
    .find((value) => value > 0) ?? 0;
  const valueChange =
    visiblePerformancePeriods.length && firstRangeValue
      ? visiblePerformancePeriods[visiblePerformancePeriods.length - 1]
          .endingValue - firstRangeValue
      : 0;
  const valueChangePct =
    visiblePerformancePeriods.length && firstRangeValue
      ? (valueChange / firstRangeValue) * 100
      : 0;
  const periodNetFlow = visiblePerformancePeriods.reduce(
    (sum, point) => sum + point.netFlow,
    0,
  );
  const periodGainLoss = visiblePerformancePeriods.reduce(
    (sum, point) => sum + point.gainLoss,
    0,
  );
  const contributionRows = useMemo(
    () => calculateContributionRows(holdings),
    [holdings],
  );
  const {
    sortedData: sortedTopHoldings,
    sortConfig: topHoldingsSortConfig,
    toggleSort: toggleTopHoldingsSort,
  } = useSortableData(
    holdings,
    [
      { id: "ticker", getValue: (row) => row.ticker },
      { id: "role", getValue: (row) => getExposureRole(row) },
      { id: "marketValue", getValue: (row) => row.marketValue },
      { id: "weightPct", getValue: (row) => row.weightPct },
      { id: "unrealizedPnlPct", getValue: (row) => row.unrealizedPnlPct },
    ],
    { id: "marketValue", direction: "desc" },
  );
  const riskInsights = useMemo(
    () => generateExposureInsights(holdings, sectorExposure, summary.hhi),
    [holdings, sectorExposure, summary.hhi],
  );
  const largestHolding = holdings[0];
  const largestSector = sectorExposure[0];
  const topThreeWeight = holdings
    .slice(0, 3)
    .reduce((sum, holding) => sum + holding.weightPct, 0);
  const closedRealizedPnl = closedPositions.reduce(
    (sum, position) => sum + position.realizedPnl,
    0,
  );
  const latestMonth = monthlyPerformance.at(-1);
  const bestMonth = [...monthlyPerformance].sort(
    (a, b) => b.returnPct - a.returnPct,
  )[0];
  const worstMonth = [...monthlyPerformance].sort(
    (a, b) => a.returnPct - b.returnPct,
  )[0];
  const sourceLabel =
    dataSource === "snapshot"
      ? "Current status snapshot"
      : dataSource === "transactions"
        ? "Transaction ledger"
        : "No portfolio loaded";
  const historyLabel = priceHistory.length
    ? "Daily price history"
    : monthlyPerformance.length
      ? "Estimated from local dates"
      : "Mock shape until dated data exists";
  const chartTitle =
    performanceView === "value"
      ? "Ending value"
      : performanceView === "return"
        ? "Flow-adjusted return"
        : "Portfolio candles";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Overview"
        title="Portfolio command center"
        description="A local-first view of value, return, exposure, concentration, and the positions driving the result."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{sourceLabel}</Badge>
        <Badge variant="outline">{historyLabel}</Badge>
        <Badge variant="outline">{holdings.length} active positions</Badge>
        {closedPositions.length ? (
          <Badge variant="outline">{closedPositions.length} closed positions</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Portfolio Value"
          value={formatCurrency(summary.portfolioValue)}
          detail={`${formatCurrency(summary.costBasis)} cost basis`}
        />
        <MetricCard
          label="Unrealized P&L"
          value={formatCurrency(summary.unrealizedPnl)}
          detail={formatPct(summary.unrealizedPnlPct)}
          tone={summary.unrealizedPnl >= 0 ? "positive" : "negative"}
        />
        <MetricCard
          label="Latest Monthly Return"
          value={latestMonth ? formatPct(latestMonth.returnPct) : "-"}
          detail={
            latestMonth
              ? `${latestMonth.label} · ${formatCurrency(latestMonth.gainLoss)} gain/loss`
              : "Needs dated imports or price history"
          }
          tone={
            latestMonth
              ? latestMonth.returnPct >= 0
                ? "positive"
                : "negative"
              : undefined
          }
        />
        <MetricCard
          label="Top 3 Weight"
          value={`${topThreeWeight.toFixed(1)}%`}
          detail={
            largestHolding
              ? `Largest: ${largestHolding.ticker} at ${largestHolding.weightPct.toFixed(1)}%`
              : "No active holdings"
          }
          tone={topThreeWeight >= 55 ? "warning" : undefined}
        />
        <MetricCard
          label="HHI Concentration"
          value={summary.hhi.toLocaleString()}
          detail="Below 1,500 is usually diversified"
          tone={summary.hhi >= 1800 ? "warning" : undefined}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Performance Over Time</CardTitle>
                    <Badge variant="outline">{historyLabel}</Badge>
                    <Badge variant="outline">{chartTitle}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>
                      <span className="font-medium text-gray-950">Range move </span>
                      <span className={`tabular-nums ${pnlClass(valueChange)}`}>
                        {formatCurrency(valueChange)} / {formatPct(valueChangePct)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-950">Gain/loss </span>
                      <span className={`tabular-nums ${pnlClass(periodGainLoss)}`}>
                        {formatCurrency(periodGainLoss)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-950">Net flow </span>
                      <span className="tabular-nums">{formatCurrency(periodNetFlow)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  <div className="flex rounded-md border bg-white p-0.5">
                    {performanceViewOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={performanceView === option.value ? "default" : "ghost"}
                        className="h-7 px-2"
                        onClick={() => setPerformanceView(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex rounded-md border bg-white p-0.5">
                    {granularityOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={effectiveGranularity === option.value ? "default" : "ghost"}
                        className="h-7 px-2"
                        onClick={() => setPerformanceGranularity(option.value)}
                        disabled={
                          !hasDailyPerformance &&
                          (option.value === "D" || option.value === "W")
                        }
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex rounded-md border bg-white p-0.5">
                    {valueRangeOptions.map((option) => (
                      <Button
                        key={option.label}
                        type="button"
                        size="sm"
                        variant={valueRange === option.label ? "default" : "ghost"}
                        className="h-7 px-2"
                        onClick={() => setValueRange(option.label)}
                      >
                        {option.label === "ALL" ? "All" : option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-2 lg:grid-cols-3">
                <LegendItem
                  color="#111827"
                  label="Value"
                  detail="Ending portfolio value for each selected period."
                />
                <LegendItem
                  color="#047857"
                  label="Green"
                  detail="Positive period return or candle close above open."
                />
                <LegendItem
                  color="#dc2626"
                  label="Red"
                  detail="Negative period return or candle close below open."
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {visiblePerformancePeriods.length ? (
              <div className="h-96">
                {performanceView === "value" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={visiblePerformancePeriods}
                      margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                    >
                      <defs>
                        <linearGradient id="valueFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#111827" stopOpacity={0.24} />
                          <stop offset="95%" stopColor="#111827" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="period"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={34}
                        interval={compactTickInterval(visiblePerformancePeriods.length)}
                        tickFormatter={(_, index) =>
                          visiblePerformancePeriods[index]?.shortLabel ?? ""
                        }
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={66}
                        domain={[
                          (value: number) => Math.max(0, Math.floor(value * 0.94)),
                          (value: number) => Math.ceil(value * 1.04),
                        ]}
                        tickFormatter={(value) => formatAxisCurrency(Number(value))}
                      />
                      <Tooltip
                        labelFormatter={(value) =>
                          visiblePerformancePeriods.find(
                            (point) => point.period === String(value),
                          )?.label ?? String(value)
                        }
                        formatter={(value) => [formatCurrency(Number(value)), "Ending value"]}
                        contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="endingValue"
                        stroke="#111827"
                        fill="url(#valueFill)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : null}
                {performanceView === "return" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={visiblePerformancePeriods}
                      margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="period"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={34}
                        interval={compactTickInterval(visiblePerformancePeriods.length)}
                        tickFormatter={(_, index) =>
                          visiblePerformancePeriods[index]?.shortLabel ?? ""
                        }
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                      />
                      <Tooltip
                        labelFormatter={(value) =>
                          visiblePerformancePeriods.find(
                            (point) => point.period === String(value),
                          )?.label ?? String(value)
                        }
                        formatter={(value) => [formatPct(Number(value)), "Flow-adjusted return"]}
                        contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                      />
                      <Bar dataKey="returnPct" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {visiblePerformancePeriods.map((point) => (
                          <Cell
                            key={point.period}
                            fill={point.returnPct >= 0 ? "#047857" : "#dc2626"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
                {performanceView === "candles" ? (
                  <CandlePerformanceChart data={visiblePerformancePeriods} />
                ) : null}
              </div>
            ) : (
              <EmptyState>
                Import dated transactions or a dated portfolio snapshot to show
                value over time.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Pulse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Best month</div>
                <div className={`mt-1 text-lg font-semibold ${pnlClass(bestMonth?.returnPct ?? 0)}`}>
                  {bestMonth ? formatPct(bestMonth.returnPct) : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {bestMonth?.label ?? "No history"}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Worst month</div>
                <div className={`mt-1 text-lg font-semibold ${pnlClass(worstMonth?.returnPct ?? 0)}`}>
                  {worstMonth ? formatPct(worstMonth.returnPct) : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {worstMonth?.label ?? "No history"}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Realized P&L</div>
                <div className={`mt-1 text-lg font-semibold ${pnlClass(closedRealizedPnl)}`}>
                  {formatCurrency(closedRealizedPnl)}
                </div>
                <div className="text-xs text-muted-foreground">Closed snapshot rows</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Largest sector</div>
                <div className="mt-1 text-lg font-semibold">
                  {largestSector ? `${largestSector.weightPct.toFixed(1)}%` : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {largestSector?.sector ?? "No exposure"}
                </div>
              </div>
            </div>
            <div className="rounded-md border bg-gray-50 p-3 text-xs leading-5 text-muted-foreground">
              For cash-flow-adjusted monthly returns, use Performance Lab. This
              overview keeps the headline read compact.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {holdings.length ? (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <SortableTableHead id="ticker" label="Ticker" sortConfig={topHoldingsSortConfig} onSort={toggleTopHoldingsSort} />
                    <SortableTableHead id="role" label="Role" sortConfig={topHoldingsSortConfig} onSort={toggleTopHoldingsSort} />
                    <SortableTableHead id="marketValue" label="Value" align="right" sortConfig={topHoldingsSortConfig} onSort={toggleTopHoldingsSort} />
                    <SortableTableHead id="weightPct" label="Weight" align="right" sortConfig={topHoldingsSortConfig} onSort={toggleTopHoldingsSort} />
                    <SortableTableHead id="unrealizedPnlPct" label="Return" align="right" sortConfig={topHoldingsSortConfig} onSort={toggleTopHoldingsSort} />
                    <TableHead className="text-right">Info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTopHoldings.slice(0, 8).map((holding) => (
                    <TableRow key={holding.ticker}>
                      <TableCell>
                        <div className="font-semibold">{holding.ticker}</div>
                        <div className="max-w-40 truncate text-muted-foreground">
                          {holding.name}
                        </div>
                      </TableCell>
                      <TableCell>{getExposureRole(holding)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyPrecise(holding.marketValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {holding.weightPct.toFixed(2)}%
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${pnlClass(holding.unrealizedPnlPct)}`}>
                        {formatPct(holding.unrealizedPnlPct)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedHolding(holding)}
                          aria-label={`Explain ${holding.ticker}`}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState>
                No active holdings yet. Import a snapshot or transaction file
                from Sync Settings.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Position Contribution</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {contributionRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={contributionRows.slice(0, 8)}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="ticker" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${Number(value) / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                  />
                  <Bar dataKey="contribution" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {contributionRows.slice(0, 8).map((row) => (
                      <Cell
                        key={row.ticker}
                        fill={row.contribution >= 0 ? "#047857" : "#dc2626"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>No contribution data yet.</EmptyState>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sector Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorExposure}
                      dataKey="value"
                      nameKey="sector"
                      innerRadius={58}
                      outerRadius={96}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {sectorExposure.map((sector, index) => (
                        <Cell
                          key={sector.sector}
                          fill={sectorColors[index % sectorColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        String(name),
                      ]}
                      contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {sectorExposure.slice(0, 6).map((sector, index) => (
                  <div key={sector.sector} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: sectorColors[index % sectorColors.length] }}
                      />
                      <span className="font-medium">{sector.sector}</span>
                    </div>
                    <div className="text-right tabular-nums">
                      <div>{sector.weightPct.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(sector.value)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk & Attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskInsights.map((insight) => (
              <div key={insight.title} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{insight.title}</div>
                  <Badge
                    variant="outline"
                    className={
                      insight.severity === "risk"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : insight.severity === "opportunity"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                    }
                  >
                    {insight.severity}
                  </Badge>
                </div>
                <div className="mt-1 text-sm leading-5 text-muted-foreground">
                  {insight.detail}
                </div>
              </div>
            ))}
            {!riskInsights.length ? (
              <EmptyState>Import holdings to generate local risk reads.</EmptyState>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Winners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topWinnersLosers.winners.map((item) => {
              const holding = holdings.find((row) => row.ticker === item.ticker);
              return (
                <div key={item.ticker} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{item.ticker}</div>
                      {holding ? (
                        <button
                          type="button"
                          onClick={() => setSelectedHolding(holding)}
                          className="rounded p-1 text-muted-foreground hover:bg-gray-100 hover:text-gray-950"
                          aria-label={`Explain ${item.ticker}`}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.name}</div>
                  </div>
                  <div className="text-right">
                    <div className={pnlClass(item.unrealizedPnl)}>
                      {formatCurrency(item.unrealizedPnl)}
                    </div>
                    <div className={pnlClass(item.unrealizedPnlPct)}>
                      {formatPct(item.unrealizedPnlPct)}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Losers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topWinnersLosers.losers.map((item) => {
              const holding = holdings.find((row) => row.ticker === item.ticker);
              return (
                <div key={item.ticker} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{item.ticker}</div>
                      {holding ? (
                        <button
                          type="button"
                          onClick={() => setSelectedHolding(holding)}
                          className="rounded p-1 text-muted-foreground hover:bg-gray-100 hover:text-gray-950"
                          aria-label={`Explain ${item.ticker}`}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.name}</div>
                  </div>
                  <div className="text-right">
                    <div className={pnlClass(item.unrealizedPnl)}>
                      {formatCurrency(item.unrealizedPnl)}
                    </div>
                    <div className={pnlClass(item.unrealizedPnlPct)}>
                      {formatPct(item.unrealizedPnlPct)}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {selectedHolding ? (
        <TickerInfoPanel
          holding={selectedHolding}
          onClose={() => setSelectedHolding(null)}
        />
      ) : null}
    </AppShell>
  );
}
