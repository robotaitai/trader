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
import { usePortfolioData } from "@/lib/storage";
import type { Holding } from "@/lib/types";
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

type ValueHistoryPoint = {
  month: string;
  label: string;
  value: number;
};

const valueRangeOptions: Array<{ label: ValueRange; months: number | null }> = [
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "3Y", months: 36 },
  { label: "ALL", months: null },
];

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
}

function axisMonthLabel(month: string, index: number, points: ValueHistoryPoint[]) {
  const year = month.slice(0, 4);
  const monthNumber = Number(month.slice(5, 7));
  const previousYear = points[index - 1]?.month.slice(0, 4);
  const shortMonth = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(new Date(Number(year), monthNumber - 1, 1));

  if (index === 0 || monthNumber === 1 || previousYear !== year) {
    return `${shortMonth} ${year}`;
  }

  return shortMonth;
}

function filterValueHistory(points: ValueHistoryPoint[], range: ValueRange) {
  const option = valueRangeOptions.find((item) => item.label === range);
  if (!option?.months) return points;
  return points.slice(-option.months);
}

function compactTickInterval(pointCount: number) {
  if (pointCount <= 8) return 0;
  if (pointCount <= 18) return 1;
  if (pointCount <= 36) return 2;
  return Math.ceil(pointCount / 12);
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
  const visibleValueHistory = useMemo(
    () => filterValueHistory(valueHistory, valueRange),
    [valueHistory, valueRange],
  );
  const valueChange =
    visibleValueHistory.length >= 2
      ? visibleValueHistory[visibleValueHistory.length - 1].value -
        visibleValueHistory[0].value
      : 0;
  const valueChangePct =
    visibleValueHistory.length >= 2 && visibleValueHistory[0].value
      ? (valueChange / visibleValueHistory[0].value) * 100
      : 0;
  const contributionRows = useMemo(
    () => calculateContributionRows(holdings),
    [holdings],
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Portfolio Value Over Time</CardTitle>
                <Badge variant="outline">{historyLabel}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs tabular-nums ${pnlClass(valueChange)}`}>
                  {visibleValueHistory.length >= 2
                    ? `${formatCurrency(valueChange)} / ${formatPct(valueChangePct)}`
                    : "No range change"}
                </span>
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
          </CardHeader>
          <CardContent>
            {visibleValueHistory.length ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={visibleValueHistory}
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
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={34}
                      interval={compactTickInterval(visibleValueHistory.length)}
                      tickFormatter={(value, index) =>
                        axisMonthLabel(String(value), index, visibleValueHistory)
                      }
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={62}
                      domain={[
                        (value: number) => Math.max(0, Math.floor(value * 0.94)),
                        (value: number) => Math.ceil(value * 1.04),
                      ]}
                      tickFormatter={(value) => `$${Number(value) / 1000}k`}
                    />
                    <Tooltip
                      labelFormatter={(value) => monthLabel(String(value))}
                      formatter={(value) => [formatCurrency(Number(value)), "Value"]}
                      contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#111827"
                      fill="url(#valueFill)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
                    <TableHead>Ticker</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.slice(0, 8).map((holding) => (
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
