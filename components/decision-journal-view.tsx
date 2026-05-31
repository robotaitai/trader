"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortfolioData } from "@/lib/storage";
import type { DecisionJournalEntry } from "@/lib/types";
import { formatCurrency, formatPct, pnlClass } from "@/lib/utils";

const JOURNAL_KEY = "investor-os.decision-journal";

function readJournal() {
  try {
    const raw = window.localStorage.getItem(JOURNAL_KEY);
    return raw ? (JSON.parse(raw) as DecisionJournalEntry[]) : [];
  } catch {
    return [];
  }
}

function writeJournal(entries: DecisionJournalEntry[]) {
  window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function DecisionJournalView() {
  const { holdings, closedPositions } = usePortfolioData();
  const [entries, setEntries] = useState<DecisionJournalEntry[]>([]);
  const [ticker, setTicker] = useState(holdings[0]?.ticker ?? "");
  const [decision, setDecision] =
    useState<DecisionJournalEntry["decision"]>("HOLD");
  const [confidence, setConfidence] = useState(60);
  const [thesis, setThesis] = useState("");
  const [risk, setRisk] = useState("");

  useEffect(() => {
    setEntries(readJournal());
  }, []);

  useEffect(() => {
    if (!ticker && holdings[0]?.ticker) {
      setTicker(holdings[0].ticker);
    }
  }, [holdings, ticker]);

  const holdingByTicker = useMemo(
    () => new Map(holdings.map((holding) => [holding.ticker, holding])),
    [holdings],
  );
  const selectedHolding = holdingByTicker.get(ticker.toUpperCase());
  const openEntries = entries.filter((entry) => entry.status === "Open");
  const reviewedEntries = entries.filter((entry) => entry.status === "Reviewed");

  function saveEntry() {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker || !thesis.trim()) return;

    const nextEntries = [
      {
        id: `decision-${Date.now()}`,
        date: today(),
        ticker: normalizedTicker,
        decision,
        thesis: thesis.trim(),
        risk: risk.trim(),
        confidence,
        status: "Open",
      } satisfies DecisionJournalEntry,
      ...entries,
    ];
    setEntries(nextEntries);
    writeJournal(nextEntries);
    setThesis("");
    setRisk("");
  }

  function markReviewed(entryId: string) {
    const nextEntries = entries.map((entry) =>
      entry.id === entryId
        ? { ...entry, status: "Reviewed" as const, reviewNote: "Reviewed locally" }
        : entry,
    );
    setEntries(nextEntries);
    writeJournal(nextEntries);
  }

  function deleteEntry(entryId: string) {
    const nextEntries = entries.filter((entry) => entry.id !== entryId);
    setEntries(nextEntries);
    writeJournal(nextEntries);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Decision Journal"
        title="Investment decisions with receipts"
        description="Capture thesis, risk, confidence, and review status locally. This is the memory layer future agents should use before giving advice."
      />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>New Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Ticker</span>
                <Input
                  value={ticker}
                  onChange={(event) => setTicker(event.target.value)}
                  placeholder="NVDA"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Decision</span>
                <select
                  value={decision}
                  onChange={(event) =>
                    setDecision(event.target.value as DecisionJournalEntry["decision"])
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {["BUY", "ADD", "HOLD", "TRIM", "SELL", "WATCH"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Thesis</span>
              <textarea
                value={thesis}
                onChange={(event) => setThesis(event.target.value)}
                placeholder="What has to be true for this decision to work?"
                className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Primary risk</span>
              <textarea
                value={risk}
                onChange={(event) => setRisk(event.target.value)}
                placeholder="What would make you change your mind?"
                className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-2 flex items-center justify-between">
                <span className="font-medium">Confidence</span>
                <span className="tabular-nums text-muted-foreground">{confidence}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={confidence}
                onChange={(event) => setConfidence(Number(event.target.value))}
                className="w-full accent-black"
              />
            </label>

            {selectedHolding ? (
              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <div className="font-medium">Current position context</div>
                <div className="mt-1 text-muted-foreground">
                  {selectedHolding.weightPct.toFixed(2)}% weight ·{" "}
                  <span className={pnlClass(selectedHolding.unrealizedPnl)}>
                    {formatCurrency(selectedHolding.unrealizedPnl)} /{" "}
                    {formatPct(selectedHolding.unrealizedPnlPct)}
                  </span>
                </div>
              </div>
            ) : null}

            <Button onClick={saveEntry} disabled={!ticker.trim() || !thesis.trim()}>
              Save decision
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Journal Health</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Open decisions</div>
              <div className="mt-1 text-2xl font-semibold">{openEntries.length}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Reviewed</div>
              <div className="mt-1 text-2xl font-semibold">{reviewedEntries.length}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Closed trades</div>
              <div className="mt-1 text-2xl font-semibold">{closedPositions.length}</div>
            </div>
            <div className="rounded-md border bg-gray-50 p-4 text-sm leading-5 text-muted-foreground sm:col-span-3">
              Local agent read: decisions without a written thesis are not
              decisions, they are impulses. Use this page before adding,
              trimming, or selling meaningful positions.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Decision Log</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length ? (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Thesis</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell className="font-semibold">{entry.ticker}</TableCell>
                    <TableCell>{entry.decision}</TableCell>
                    <TableCell className="max-w-lg">
                      <div className="line-clamp-2">{entry.thesis}</div>
                      {entry.risk ? (
                        <div className="mt-1 text-muted-foreground">
                          Risk: {entry.risk}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.confidence}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          entry.status === "Open"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {entry.status === "Open" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markReviewed(entry.id)}
                          >
                            Review
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteEntry(entry.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
              No decisions saved yet.
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
