"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { InsightList } from "@/components/insight-list";
import { PageHeader } from "@/components/page-header";
import {
  SortableTableHead,
  useSortableData,
} from "@/components/sortable-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LocalInsight } from "@/lib/portfolio-lab";
import { usePortfolioData } from "@/lib/storage";
import type { DecisionJournalEntry } from "@/lib/types";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatPct,
  pnlClass,
} from "@/lib/utils";

const JOURNAL_KEY = "investor-os.decision-journal";

function readJournal() {
  try {
    const raw = window.localStorage.getItem(JOURNAL_KEY);
    return raw ? (JSON.parse(raw) as DecisionJournalEntry[]) : [];
  } catch {
    return [];
  }
}

function scoreClass(score: number) {
  if (score >= 75) return "text-emerald-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

function MirrorMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold tracking-tight ${tone ?? ""}`}>
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

export function InvestorMirrorView() {
  const { closedPositions, holdings, sectorExposure, summary } = usePortfolioData();
  const [journalEntries, setJournalEntries] = useState<DecisionJournalEntry[]>([]);

  useEffect(() => {
    setJournalEntries(readJournal());
  }, []);

  const journaledTickers = useMemo(
    () => new Set(journalEntries.map((entry) => entry.ticker.toUpperCase())),
    [journalEntries],
  );
  const openEntries = useMemo(
    () => journalEntries.filter((entry) => entry.status === "Open"),
    [journalEntries],
  );
  const reviewedEntries = useMemo(
    () => journalEntries.filter((entry) => entry.status === "Reviewed"),
    [journalEntries],
  );
  const materialPositions = useMemo(
    () => holdings.filter((holding) => holding.weightPct >= 5),
    [holdings],
  );
  const unjournaledMaterialPositions = useMemo(
    () =>
      materialPositions.filter(
        (holding) => !journaledTickers.has(holding.ticker.toUpperCase()),
      ),
    [journaledTickers, materialPositions],
  );
  const largestHolding = useMemo(
    () => [...holdings].sort((a, b) => b.weightPct - a.weightPct)[0],
    [holdings],
  );
  const largestSector = sectorExposure[0];
  const closedWins = closedPositions.filter((position) => position.realizedPnl > 0);
  const winRate = closedPositions.length
    ? (closedWins.length / closedPositions.length) * 100
    : 0;
  const realizedPnl = closedPositions.reduce(
    (sum, position) => sum + position.realizedPnl,
    0,
  );
  const journalCoveragePct = materialPositions.length
    ? ((materialPositions.length - unjournaledMaterialPositions.length) /
        materialPositions.length) *
      100
    : 0;
  const reviewCoveragePct = journalEntries.length
    ? (reviewedEntries.length / journalEntries.length) * 100
    : 0;
  const concentrationScore = largestHolding
    ? largestHolding.weightPct <= 15
      ? 100
      : largestHolding.weightPct <= 25
        ? 70
        : 40
    : 0;
  const processScore =
    holdings.length || journalEntries.length
      ? Math.round(
          (journalCoveragePct +
            reviewCoveragePct +
            concentrationScore +
            (closedPositions.length >= 3
              ? 100
              : closedPositions.length > 0
                ? 70
                : 40)) /
            4,
        )
      : 0;
  const reviewQueue = openEntries
    .map((entry) => ({
      ...entry,
      holding: holdings.find((holding) => holding.ticker === entry.ticker),
    }))
    .sort((a, b) => (b.holding?.weightPct ?? 0) - (a.holding?.weightPct ?? 0));
  const checklistRows = [
    {
      item: "Material thesis coverage",
      status: unjournaledMaterialPositions.length === 0 && materialPositions.length > 0,
      detail: materialPositions.length
        ? `${journalCoveragePct.toFixed(0)}% of positions above 5% have a journal entry`
        : "No material positions above 5%",
    },
    {
      item: "Review discipline",
      status: openEntries.length === 0 && journalEntries.length > 0,
      detail: journalEntries.length
        ? `${openEntries.length} open / ${reviewedEntries.length} reviewed`
        : "No decisions logged yet",
    },
    {
      item: "Concentration rule pressure",
      status: Boolean(largestHolding && largestHolding.weightPct <= 15),
      detail: largestHolding
        ? `${largestHolding.ticker} is ${largestHolding.weightPct.toFixed(2)}%`
        : "No active holdings",
    },
    {
      item: "Closed-trade evidence",
      status: closedPositions.length >= 3,
      detail: closedPositions.length
        ? `${closedPositions.length} closed positions, ${winRate.toFixed(0)}% win rate`
        : "No closed positions captured",
    },
  ];
  const {
    sortedData: sortedChecklistRows,
    sortConfig: checklistSortConfig,
    toggleSort: toggleChecklistSort,
  } = useSortableData(
    checklistRows,
    [
      { id: "item", getValue: (row) => row.item },
      { id: "status", getValue: (row) => (row.status ? "Covered" : "Needs work") },
      { id: "detail", getValue: (row) => row.detail },
    ],
    { id: "item", direction: "asc" },
  );
  const {
    sortedData: sortedReviewQueue,
    sortConfig: reviewQueueSortConfig,
    toggleSort: toggleReviewQueueSort,
  } = useSortableData(
    reviewQueue,
    [
      { id: "date", getValue: (row) => row.date },
      { id: "ticker", getValue: (row) => row.ticker },
      { id: "decision", getValue: (row) => row.decision },
      { id: "weight", getValue: (row) => row.holding?.weightPct ?? 0 },
      { id: "confidence", getValue: (row) => row.confidence },
    ],
    { id: "weight", direction: "desc" },
  );
  const {
    sortedData: sortedClosedPositions,
    sortConfig: closedSortConfig,
    toggleSort: toggleClosedSort,
  } = useSortableData(
    closedPositions,
    [
      { id: "ticker", getValue: (row) => row.ticker },
      { id: "realizedPnl", getValue: (row) => row.realizedPnl },
      { id: "realizedPnlPct", getValue: (row) => row.realizedPnlPct },
      { id: "soldDate", getValue: (row) => row.soldDate },
    ],
    { id: "realizedPnl", direction: "desc" },
  );
  const {
    sortedData: sortedUnjournaledMaterialPositions,
    sortConfig: unjournaledSortConfig,
    toggleSort: toggleUnjournaledSort,
  } = useSortableData(
    unjournaledMaterialPositions,
    [
      { id: "ticker", getValue: (row) => row.ticker },
      { id: "sector", getValue: (row) => row.sector },
      { id: "weightPct", getValue: (row) => row.weightPct },
      { id: "unrealizedPnl", getValue: (row) => row.unrealizedPnl },
      { id: "unrealizedPnlPct", getValue: (row) => row.unrealizedPnlPct },
    ],
    { id: "weightPct", direction: "desc" },
  );

  const insights = useMemo<LocalInsight[]>(() => {
    const nextInsights: LocalInsight[] = [];

    if (largestHolding && largestHolding.weightPct >= 15) {
      nextInsights.push({
        title: "Your process starts with position sizing",
        detail: `${largestHolding.ticker} is ${largestHolding.weightPct.toFixed(2)}% of the portfolio. The next decision should be rule-based, not mood-based.`,
        severity: largestHolding.weightPct >= 25 ? "risk" : "watch",
      });
    }

    if (largestSector && largestSector.weightPct >= 35) {
      nextInsights.push({
        title: "Sector exposure can hide as stock picking",
        detail: `${largestSector.sector} is ${largestSector.weightPct.toFixed(2)}% of active value. Judge results against that factor exposure.`,
        severity: largestSector.weightPct >= 50 ? "risk" : "watch",
      });
    }

    if (unjournaledMaterialPositions.length > 0) {
      nextInsights.push({
        title: "Material positions need written reasons",
        detail: `${unjournaledMaterialPositions.length} position${unjournaledMaterialPositions.length === 1 ? "" : "s"} above 5% weight have no journal entry yet.`,
        severity: "watch",
      });
    }

    if (closedPositions.length > 0) {
      nextInsights.push({
        title: "Closed trades are now measurable",
        detail: `Realized P&L is ${formatCurrency(realizedPnl)} with a ${winRate.toFixed(0)}% win rate across ${closedPositions.length} closed position${closedPositions.length === 1 ? "" : "s"}.`,
        severity: realizedPnl >= 0 ? "opportunity" : "risk",
      });
    }

    if (openEntries.length > 0) {
      nextInsights.push({
        title: "Open decisions need review",
        detail: `${openEntries.length} journal entr${openEntries.length === 1 ? "y is" : "ies are"} still open. Review after price movement or thesis news, not randomly.`,
        severity: "watch",
      });
    }

    if (nextInsights.length === 0) {
      nextInsights.push({
        title: "Mirror needs more personal data",
        detail: "Import holdings and add decision journal entries to produce useful behavioral reads.",
        severity: "watch",
      });
    }

    return nextInsights.slice(0, 4);
  }, [
    closedPositions.length,
    largestHolding,
    largestSector,
    openEntries.length,
    realizedPnl,
    unjournaledMaterialPositions.length,
    winRate,
  ]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Investor Mirror"
        title="Behavioral audit of your portfolio process"
        description="A local rule-based mirror that checks concentration, journaling discipline, realized outcomes, and unreviewed decisions."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MirrorMetric
          label="Process Score"
          value={holdings.length || journalEntries.length ? `${processScore}/100` : "-"}
          detail="Coverage, reviews, concentration, and closed-trade evidence"
          tone={scoreClass(processScore)}
        />
        <MirrorMetric
          label="Journal Coverage"
          value={materialPositions.length ? formatPct(journalCoveragePct) : "-"}
          detail={`${materialPositions.length} material positions above 5%`}
        />
        <MirrorMetric
          label="Closed Win Rate"
          value={closedPositions.length ? formatPct(winRate) : "-"}
          detail={`${closedPositions.length} closed positions captured`}
        />
        <MirrorMetric
          label="Total P&L"
          value={formatCurrency(summary.unrealizedPnl + realizedPnl)}
          detail="Unrealized plus realized snapshot P&L"
          tone={pnlClass(summary.unrealizedPnl + realizedPnl)}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Process Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <SortableTableHead id="item" label="Check" sortConfig={checklistSortConfig} onSort={toggleChecklistSort} />
                  <SortableTableHead id="status" label="Status" sortConfig={checklistSortConfig} onSort={toggleChecklistSort} />
                  <SortableTableHead id="detail" label="Read" sortConfig={checklistSortConfig} onSort={toggleChecklistSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChecklistRows.map((row) => (
                  <TableRow key={row.item}>
                    <TableCell className="font-medium">{row.item}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }
                      >
                        {row.status ? "Covered" : "Needs work"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <InsightList title="Local Mirror Notes" insights={insights} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Review Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {reviewQueue.length ? (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <SortableTableHead id="date" label="Date" sortConfig={reviewQueueSortConfig} onSort={toggleReviewQueueSort} />
                    <SortableTableHead id="ticker" label="Ticker" sortConfig={reviewQueueSortConfig} onSort={toggleReviewQueueSort} />
                    <SortableTableHead id="decision" label="Decision" sortConfig={reviewQueueSortConfig} onSort={toggleReviewQueueSort} />
                    <SortableTableHead id="weight" label="Weight" align="right" sortConfig={reviewQueueSortConfig} onSort={toggleReviewQueueSort} />
                    <SortableTableHead id="confidence" label="Confidence" align="right" sortConfig={reviewQueueSortConfig} onSort={toggleReviewQueueSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedReviewQueue.slice(0, 8).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell className="font-semibold">{entry.ticker}</TableCell>
                      <TableCell>{entry.decision}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.holding ? `${entry.holding.weightPct.toFixed(2)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.confidence}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
                No open journal entries. New decisions will appear here until
                reviewed.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Closed Trade Diagnostics</CardTitle>
          </CardHeader>
          <CardContent>
            {closedPositions.length ? (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <SortableTableHead id="ticker" label="Ticker" sortConfig={closedSortConfig} onSort={toggleClosedSort} />
                    <SortableTableHead id="realizedPnl" label="P&L" align="right" sortConfig={closedSortConfig} onSort={toggleClosedSort} />
                    <SortableTableHead id="realizedPnlPct" label="Return" align="right" sortConfig={closedSortConfig} onSort={toggleClosedSort} />
                    <SortableTableHead id="soldDate" label="Closed" sortConfig={closedSortConfig} onSort={toggleClosedSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedClosedPositions.slice(0, 8).map((position) => (
                    <TableRow key={`${position.ticker}-${position.soldDate ?? "closed"}`}>
                      <TableCell className="font-semibold">{position.ticker}</TableCell>
                      <TableCell className={`text-right tabular-nums ${pnlClass(position.realizedPnl)}`}>
                        {formatCurrencyPrecise(position.realizedPnl)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${pnlClass(position.realizedPnlPct)}`}>
                        {formatPct(position.realizedPnlPct)}
                      </TableCell>
                      <TableCell>{position.soldDate ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
                Closed rows from your portfolio status import will appear here
                as realized evidence.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Material Positions Without Journal</CardTitle>
        </CardHeader>
        <CardContent>
          {unjournaledMaterialPositions.length ? (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <SortableTableHead id="ticker" label="Ticker" sortConfig={unjournaledSortConfig} onSort={toggleUnjournaledSort} />
                  <SortableTableHead id="sector" label="Sector" sortConfig={unjournaledSortConfig} onSort={toggleUnjournaledSort} />
                  <SortableTableHead id="weightPct" label="Weight" align="right" sortConfig={unjournaledSortConfig} onSort={toggleUnjournaledSort} />
                  <SortableTableHead id="unrealizedPnl" label="P&L" align="right" sortConfig={unjournaledSortConfig} onSort={toggleUnjournaledSort} />
                  <SortableTableHead id="unrealizedPnlPct" label="Return" align="right" sortConfig={unjournaledSortConfig} onSort={toggleUnjournaledSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUnjournaledMaterialPositions.map((holding) => (
                  <TableRow key={holding.ticker}>
                    <TableCell className="font-semibold">{holding.ticker}</TableCell>
                    <TableCell>{holding.sector}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {holding.weightPct.toFixed(2)}%
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${pnlClass(holding.unrealizedPnl)}`}>
                      {formatCurrency(holding.unrealizedPnl)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${pnlClass(holding.unrealizedPnlPct)}`}>
                      {formatPct(holding.unrealizedPnlPct)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
              Every material active position has a journal entry, or there are
              no active positions above 5%.
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
