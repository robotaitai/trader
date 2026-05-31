"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { InsightList } from "@/components/insight-list";
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
import {
  calculateContributionRows,
  calculateMonthlyPerformance,
  calculateScenarioRows,
  calculateWeightedReturn,
  generatePerformanceInsights,
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
  pnlClass,
} from "@/lib/utils";

function LabMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function isClosedSnapshotRow(row: PortfolioSnapshotRow) {
  return (
    row.status === "Closed" ||
    Boolean(row.soldDate) ||
    Boolean(row.soldPrice) ||
    Boolean(row.finalEarning)
  );
}

function buildHistoryTickers(
  holdings: Holding[],
  snapshotRows: PortfolioSnapshotRow[],
) {
  const tickers = new Set(holdings.map((holding) => holding.ticker));

  snapshotRows.forEach((row) => {
    if (row.purchaseDate) {
      tickers.add(normalizeTicker(row.ticker));
    }
  });

  return Array.from(tickers).filter(Boolean);
}

export function PerformanceLabView() {
  const {
    holdings,
    summary,
    sectorExposure,
    closedPositions,
    transactions,
    portfolioSnapshot,
    currentPrices,
    priceHistory,
    setPriceHistory,
  } = usePortfolioData();
  const [marketShockPct, setMarketShockPct] = useState(-10);
  const [focusedSector, setFocusedSector] = useState("All");
  const [focusedSectorShockPct, setFocusedSectorShockPct] = useState(-18);
  const [priceFetchStatus, setPriceFetchStatus] = useState("");
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);

  const contributionRows = useMemo(
    () => calculateContributionRows(holdings),
    [holdings],
  );
  const activeLotCounts = useMemo(() => {
    const counts = new Map<string, number>();

    portfolioSnapshot
      .filter((row) => !isClosedSnapshotRow(row))
      .forEach((row) => {
        const ticker = normalizeTicker(row.ticker);
        counts.set(ticker, (counts.get(ticker) ?? 0) + 1);
      });

    return counts;
  }, [portfolioSnapshot]);
  const closedByTicker = useMemo(() => {
    const rows = new Map<
      string,
      {
        lots: number;
        realizedPnl: number;
        costBasis: number;
      }
    >();

    closedPositions.forEach((position) => {
      const existing = rows.get(position.ticker) ?? {
        lots: 0,
        realizedPnl: 0,
        costBasis: 0,
      };
      existing.lots += 1;
      existing.realizedPnl += position.realizedPnl;
      existing.costBasis += position.costBasis;
      rows.set(position.ticker, existing);
    });

    return new Map(
      Array.from(rows.entries()).map(([ticker, row]) => [
        ticker,
        {
          lots: row.lots,
          realizedPnl: row.realizedPnl,
          realizedPnlPct: row.costBasis
            ? (row.realizedPnl / row.costBasis) * 100
            : 0,
        },
      ]),
    );
  }, [closedPositions]);
  const scenarioRows = useMemo(
    () =>
      calculateScenarioRows(
        holdings,
        marketShockPct,
        focusedSector,
        focusedSectorShockPct,
      ),
    [holdings, marketShockPct, focusedSector, focusedSectorShockPct],
  );
  const scenarioValue = scenarioRows.reduce(
    (sum, row) => sum + row.scenarioValue,
    0,
  );
  const scenarioDelta = scenarioRows.reduce((sum, row) => sum + row.delta, 0);
  const weightedReturn = calculateWeightedReturn(holdings);
  const insights = generatePerformanceInsights(
    holdings,
    sectorExposure,
    summary,
  );
  const sectors = ["All", ...sectorExposure.map((sector) => sector.sector)];
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
  const monthlyDataSource = priceHistory.length > 0
    ? "daily-prices"
    : "estimated";
  const priceHistoryTickers = new Set(priceHistory.map((point) => point.ticker));
  const incompleteSnapshotRows = portfolioSnapshot.filter(
    (row) =>
      (row.status === "Active" || isClosedSnapshotRow(row)) &&
      !row.purchaseDate,
  );
  const missingHistoryTickers = holdings
    .map((holding) => holding.ticker)
    .filter((ticker) => priceHistory.length > 0 && !priceHistoryTickers.has(ticker));

  const refreshPriceHistory = useCallback(async (trigger: "auto" | "manual" = "manual") => {
    const tickers = buildHistoryTickers(holdings, portfolioSnapshot);
    if (!tickers.length) {
      setPriceFetchStatus("Import holdings before fetching price history.");
      return;
    }

    setIsFetchingPrices(true);
    setPriceFetchStatus(
      trigger === "auto"
        ? "Fetching daily adjusted closes automatically..."
        : "Fetching daily adjusted closes...",
    );
    const from = findEarliestPortfolioDate(transactions, portfolioSnapshot);
    const to = new Date().toISOString().slice(0, 10);
    const response = await fetch(
      `/api/price-history?tickers=${encodeURIComponent(tickers.join(","))}&from=${from}&to=${to}`,
    );

    if (!response.ok) {
      setPriceFetchStatus("Price history fetch failed. Try again later.");
      setIsFetchingPrices(false);
      return;
    }

    const payload = (await response.json()) as {
      prices: PriceHistoryPoint[];
      errors?: Array<{ ticker: string; error: string }>;
    };

    setPriceHistory(payload.prices);
    setIsFetchingPrices(false);
    setPriceFetchStatus(
      payload.errors?.length
        ? `Fetched ${payload.prices.length.toLocaleString()} daily prices. Missing: ${payload.errors.map((error) => error.ticker).join(", ")}.`
        : `Fetched ${payload.prices.length.toLocaleString()} daily prices from Yahoo Finance.`,
    );
  }, [holdings, portfolioSnapshot, setPriceHistory, transactions]);

  useEffect(() => {
    if (holdings.length > 0 && priceHistory.length === 0 && !priceFetchStatus) {
      void refreshPriceHistory("auto");
    }
  }, [holdings.length, priceHistory.length, priceFetchStatus, refreshPriceHistory]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Performance Lab"
        title="Return drivers and stress tests"
        description="Break portfolio returns into position contribution, then run local what-if shocks without sending data anywhere."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LabMetric
          label="Weighted Return"
          value={formatPct(weightedReturn)}
          detail="Unrealized P&L divided by active cost basis"
        />
        <LabMetric
          label="Scenario Value"
          value={formatCurrency(scenarioValue)}
          detail={`${formatCurrency(scenarioDelta)} scenario delta`}
        />
        <LabMetric
          label="Best Contributor"
          value={contributionRows[0]?.ticker ?? "-"}
          detail={
            contributionRows[0]
              ? formatCurrency(contributionRows[0].contribution)
              : "No holdings"
          }
        />
        <LabMetric
          label="Worst Contributor"
          value={contributionRows.at(-1)?.ticker ?? "-"}
          detail={
            contributionRows.at(-1)
              ? formatCurrency(contributionRows.at(-1)?.contribution ?? 0)
              : "No holdings"
          }
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Monthly Flow-Adjusted Performance</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    monthlyDataSource === "daily-prices"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }
                >
                  {monthlyDataSource === "daily-prices"
                    ? "Daily prices"
                    : "Estimated"}
                </Badge>
              </div>
              <div className="flex gap-2">
                {priceHistory.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPriceHistory([]);
                      setPriceFetchStatus("Cleared fetched daily prices. Chart is back to estimated mode.");
                    }}
                  >
                    Clear prices
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshPriceHistory("manual")}
                  disabled={isFetchingPrices}
                >
                  {isFetchingPrices ? "Fetching..." : "Fetch daily prices"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-md border bg-gray-50 p-3 text-xs leading-5 text-muted-foreground">
              {monthlyDataSource === "daily-prices"
                ? "Using fetched daily adjusted closes to calculate month-by-month flow-adjusted returns."
                : "Estimated mode uses your transaction/snapshot dates and current prices. Click Fetch daily prices for actual historical monthly performance."}
            </div>
            {priceFetchStatus ? (
              <div className="mb-3 rounded-md border bg-gray-50 p-3 text-xs text-muted-foreground">
                {priceFetchStatus}
              </div>
            ) : null}
            {missingHistoryTickers.length > 0 ? (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Missing price history for {missingHistoryTickers.join(", ")}.
              </div>
            ) : null}
            {incompleteSnapshotRows.length > 0 ? (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                {incompleteSnapshotRows.length} snapshot row
                {incompleteSnapshotRows.length === 1 ? "" : "s"} missing purchase
                dates are excluded from monthly performance. Holdings and active
                P&L still use those rows, but month-by-month returns need dated
                lots to avoid false spikes.
              </div>
            ) : null}
            {monthlyPerformance.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyPerformance}
                    margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="returnFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#111827" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#111827" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        name === "returnPct"
                          ? `${Number(value).toFixed(2)}%`
                          : formatCurrency(Number(value)),
                        name === "returnPct" ? "Return" : String(name),
                      ]}
                      contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="returnPct"
                      stroke="#111827"
                      fill="url(#returnFill)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-md border bg-gray-50 p-6 text-sm leading-5 text-muted-foreground">
                No dated transaction or snapshot history is available yet. To
                calculate month-by-month performance, import transactions with
                dates or include purchase/sold dates in the portfolio snapshot.
                For real market performance, fetch daily prices.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Return Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyPerformance.length ? (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Gain/Loss</TableHead>
                    <TableHead className="text-right">Net Flow</TableHead>
                    <TableHead className="text-right">End Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyPerformance.slice(-12).map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className={`text-right tabular-nums ${pnlClass(row.returnPct)}`}>
                        {formatPct(row.returnPct)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${pnlClass(row.gainLoss)}`}>
                        {formatCurrencyPrecise(row.gainLoss)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyPrecise(row.netFlow)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyPrecise(row.endingValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-md border bg-gray-50 p-6 text-sm leading-5 text-muted-foreground">
                This is the place to see whether the portfolio went up or down
                month by month after separating added/removed money.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Active Position Contribution</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={contributionRows.slice(0, 10)}
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
                  {contributionRows.slice(0, 10).map((row) => (
                    <Cell
                      key={row.ticker}
                      fill={row.contribution >= 0 ? "#047857" : "#dc2626"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="block text-sm">
              <span className="mb-2 flex items-center justify-between">
                <span className="font-medium">Market shock</span>
                <span className="tabular-nums text-muted-foreground">
                  {marketShockPct}%
                </span>
              </span>
              <input
                type="range"
                min="-40"
                max="25"
                step="1"
                value={marketShockPct}
                onChange={(event) => setMarketShockPct(Number(event.target.value))}
                className="w-full accent-black"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium">Focused sector</span>
              <select
                value={focusedSector}
                onChange={(event) => setFocusedSector(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector === "All" ? "No focused sector" : sector}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-2 flex items-center justify-between">
                <span className="font-medium">Focused sector shock</span>
                <span className="tabular-nums text-muted-foreground">
                  {focusedSectorShockPct}%
                </span>
              </span>
              <input
                type="range"
                min="-50"
                max="30"
                step="1"
                value={focusedSectorShockPct}
                onChange={(event) =>
                  setFocusedSectorShockPct(Number(event.target.value))
                }
                className="w-full accent-black"
                disabled={focusedSector === "All"}
              />
            </label>

            <div className="rounded-md border bg-gray-50 p-4">
              <div className="text-sm font-medium">Local agent read</div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                This lab is using rules over your local holdings. A real agent
                can later turn these deterministic reads into richer thesis and
                action workflows.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Open vs Closed Lot Contribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border bg-gray-50 p-3 text-xs leading-5 text-muted-foreground">
            This separates active unrealized performance from closed realized
            lots. If a ticker appears in both places, the active return is only
            for the still-open position.
          </div>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Open Lots</TableHead>
                <TableHead className="text-right">Active Value</TableHead>
                <TableHead className="text-right">Active P&L</TableHead>
                <TableHead className="text-right">Active Return</TableHead>
                <TableHead className="text-right">Closed Lots</TableHead>
                <TableHead className="text-right">Closed P&L</TableHead>
                <TableHead>Read</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((holding) => {
                const closed = closedByTicker.get(holding.ticker);
                const activeLots = activeLotCounts.get(holding.ticker) ?? 1;

                return (
                  <TableRow key={holding.ticker}>
                    <TableCell className="font-semibold">{holding.ticker}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {activeLots}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(holding.marketValue)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${pnlClass(holding.unrealizedPnl)}`}>
                      {formatCurrencyPrecise(holding.unrealizedPnl)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${pnlClass(holding.unrealizedPnlPct)}`}>
                      {formatPct(holding.unrealizedPnlPct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {closed?.lots ?? 0}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${pnlClass(closed?.realizedPnl ?? 0)}`}>
                      {closed ? formatCurrencyPrecise(closed.realizedPnl) : "-"}
                    </TableCell>
                    <TableCell>
                      {closed
                        ? "Has closed history; active return excludes realized lots"
                        : "Active position only"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Scenario Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Scenario</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">Scenario P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarioRows
                  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                  .map((row) => (
                    <TableRow key={row.ticker}>
                      <TableCell className="font-semibold">{row.ticker}</TableCell>
                      <TableCell className="max-w-44 truncate">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyPrecise(row.currentValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyPrecise(row.scenarioValue)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${pnlClass(row.delta)}`}>
                        {formatCurrencyPrecise(row.delta)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${pnlClass(row.scenarioPnl)}`}>
                        {formatCurrencyPrecise(row.scenarioPnl)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <InsightList title="Local Agent Notes" insights={insights} />
      </div>
    </AppShell>
  );
}

function findEarliestPortfolioDate(
  transactions: Transaction[],
  snapshotRows: PortfolioSnapshotRow[],
) {
  const dates = [
    ...transactions.map((transaction) => transaction.date),
    ...snapshotRows.flatMap((row) => [row.purchaseDate, row.soldDate]),
  ]
    .filter((date): date is string => Boolean(date))
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return (dates[0] ?? new Date(new Date().getFullYear() - 3, 0, 1))
    .toISOString()
    .slice(0, 10);
}
