"use client";

import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
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
import { normalizeTicker } from "@/lib/security-classification";
import { usePortfolioData } from "@/lib/storage";
import type {
  PortfolioSnapshotRow,
  PortfolioSnapshotStatus,
  PriceHistoryPoint,
  Transaction,
  TransactionAction,
} from "@/lib/types";

type RawRow = Record<string, unknown>;
type ColumnMap = Record<string, string>;

const requiredFields = ["date", "ticker", "action", "quantity", "price"] as const;
const optionalFields = ["currency", "fees", "notes"] as const;
const validActions = new Set<TransactionAction>([
  "BUY",
  "SELL",
  "DIVIDEND",
  "DEPOSIT",
  "WITHDRAWAL",
  "FEE",
  "TAX",
]);

const headerAliases: Record<string, string[]> = {
  date: ["date", "tradedate", "transactiondate", "settledate"],
  ticker: ["ticker", "symbol", "security", "instrument"],
  action: ["action", "type", "transactiontype", "activitytype"],
  quantity: ["quantity", "qty", "shares", "units"],
  price: ["price", "unitprice", "shareprice", "executionprice"],
  currency: ["currency", "ccy", "curr"],
  fees: ["fees", "fee", "commission", "commissions"],
  notes: ["notes", "note", "memo", "description"],
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMapColumns(headers: string[]): ColumnMap {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));
  const map: ColumnMap = {};

  for (const [field, aliases] of Object.entries(headerAliases)) {
    const found = normalizedHeaders.find((header) =>
      aliases.includes(header.normalized),
    );
    if (found) map[field] = found.original;
  }

  return map;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "")
    .replace(/[₪"$,%]/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!normalized) return NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? "").trim();
  const numericDate = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);

  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    const year =
      numericDate[3].length === 2
        ? Number(`20${numericDate[3]}`)
        : Number(numericDate[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return raw;
}

function normalizeAction(value: unknown): TransactionAction | null {
  const action = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (validActions.has(action as TransactionAction)) {
    return action as TransactionAction;
  }

  if (["BUY_TO_OPEN", "PURCHASE", "BOUGHT"].includes(action)) return "BUY";
  if (["SELL_TO_CLOSE", "SOLD", "SALE"].includes(action)) return "SELL";
  if (["DIV", "DIVIDENDS"].includes(action)) return "DIVIDEND";

  return null;
}

function buildTransactions(rows: RawRow[], columnMap: ColumnMap) {
  const errors: string[] = [];
  const importedAt = Date.now();
  const transactions: Transaction[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const date = normalizeDate(row[columnMap.date]);
    const ticker = normalizeTicker(String(row[columnMap.ticker] ?? ""));
    const action = normalizeAction(row[columnMap.action]);
    const quantity = parseNumber(row[columnMap.quantity]);
    const price = parseNumber(row[columnMap.price]);
    const fees = columnMap.fees ? parseNumber(row[columnMap.fees]) : 0;

    if (!date || !ticker || !action || !Number.isFinite(quantity) || !Number.isFinite(price)) {
      errors.push(`Row ${rowNumber}: missing or invalid required values.`);
      return;
    }

    transactions.push({
      id: `import-${importedAt}-${index}`,
      date,
      ticker,
      action,
      quantity,
      price,
      currency: columnMap.currency
        ? String(row[columnMap.currency] ?? "USD").trim().toUpperCase() || "USD"
        : "USD",
      fees: Number.isFinite(fees) ? fees : 0,
      notes: columnMap.notes ? String(row[columnMap.notes] ?? "") : "",
    });
  });

  return { transactions, errors };
}

const snapshotAliases: Record<string, string[]> = {
  ticker: ["ticker", "symbol"],
  securityType: ["securitytype", "type", "assetclass"],
  shares: ["shares", "quantity", "qty", "units"],
  purchaseDate: ["purchasedate", "buydate", "date"],
  purchasePrice: ["purchaseprice", "buyprice", "avgcost", "averagecost"],
  currentPrice: ["currentprice", "marketprice", "price"],
  valueUsd: ["valueusd", "marketvalue", "value"],
  valueNis: ["valuenis", "valueils", "valuenils"],
  costBasis: ["costbasis", "cost"],
  earningsPct: ["erningsprct", "earningspct", "earningspercent", "returnpct"],
  soldDate: ["solddate", "selldate"],
  soldPrice: ["soldprice", "sellprice"],
  stopLossPrice: ["stoplossprice", "stoploss"],
  status: ["status", "state"],
  finalEarning: ["finalearning", "realizedpnl", "realizedearning"],
  activeEarning: ["activeearning", "unrealizedpnl", "unrealizedearning"],
};

function findColumn(row: RawRow, field: string) {
  const aliases = snapshotAliases[field];
  return Object.keys(row).find((key) => aliases.includes(normalizeHeader(key)));
}

function parseRowsFromText(text: string) {
  const workbook = XLSX.read(text, { type: "string", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRow>(firstSheet, {
    defval: "",
    raw: false,
  });
}

async function parseRowsFromFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
  });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRow>(firstSheet, {
    defval: "",
    raw: false,
  });
}

function normalizeSnapshotStatus(value: unknown): PortfolioSnapshotStatus | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["closed", "sold", "exited", "liquidated", "realized"].includes(normalized)) {
    return "Closed";
  }
  return "Active";
}

function twoWeeksAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  return date.toISOString().slice(0, 10);
}

function buildSnapshotRows(rows: RawRow[]) {
  const errors: string[] = [];
  const importedAt = Date.now();
  const snapshotRows: PortfolioSnapshotRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const tickerColumn = findColumn(row, "ticker");
    const sharesColumn = findColumn(row, "shares");
    const purchasePriceColumn = findColumn(row, "purchasePrice");
    const currentPriceColumn = findColumn(row, "currentPrice");
    const statusColumn = findColumn(row, "status");

    const ticker = tickerColumn
      ? normalizeTicker(String(row[tickerColumn] ?? ""))
      : "";
    const shares = sharesColumn ? parseNumber(row[sharesColumn]) : NaN;
    const purchasePrice = purchasePriceColumn
      ? parseNumber(row[purchasePriceColumn])
      : NaN;
    const currentPrice = currentPriceColumn
      ? parseNumber(row[currentPriceColumn])
      : NaN;

    if (!ticker || !Number.isFinite(shares) || !Number.isFinite(purchasePrice)) {
      errors.push(`Row ${rowNumber}: ticker, shares, and purchase price are required.`);
      return;
    }

    const valueUsdColumn = findColumn(row, "valueUsd");
    const valueNisColumn = findColumn(row, "valueNis");
    const costBasisColumn = findColumn(row, "costBasis");
    const earningsPctColumn = findColumn(row, "earningsPct");
    const soldDateColumn = findColumn(row, "soldDate");
    const soldPriceColumn = findColumn(row, "soldPrice");
    const stopLossColumn = findColumn(row, "stopLossPrice");
    const securityTypeColumn = findColumn(row, "securityType");
    const purchaseDateColumn = findColumn(row, "purchaseDate");
    const finalEarningColumn = findColumn(row, "finalEarning");
    const activeEarningColumn = findColumn(row, "activeEarning");
    const explicitStatus = statusColumn
      ? normalizeSnapshotStatus(row[statusColumn])
      : null;
    const hasClosedTradeFields =
      Boolean(soldDateColumn && String(row[soldDateColumn] ?? "").trim()) ||
      Boolean(soldPriceColumn && String(row[soldPriceColumn] ?? "").trim()) ||
      Boolean(finalEarningColumn && String(row[finalEarningColumn] ?? "").trim());
    const status = explicitStatus ?? (hasClosedTradeFields ? "Closed" : "Active");
    const parsedCurrentPrice = Number.isFinite(currentPrice)
      ? currentPrice
      : purchasePrice;
    const parsedValueUsd = valueUsdColumn
      ? parseNumber(row[valueUsdColumn])
      : shares * parsedCurrentPrice;
    const parsedCostBasis = costBasisColumn
      ? parseNumber(row[costBasisColumn])
      : shares * purchasePrice;
    const parsedActiveEarning = activeEarningColumn
      ? parseNumber(row[activeEarningColumn])
      : parsedValueUsd - parsedCostBasis;

    snapshotRows.push({
      id: `snapshot-${importedAt}-${index}`,
      ticker,
      securityType: securityTypeColumn
        ? String(row[securityTypeColumn] ?? "Manual").trim() || "Manual"
        : "Manual",
      shares,
      purchaseDate: purchaseDateColumn
        ? normalizeDate(row[purchaseDateColumn])
        : undefined,
      purchasePrice,
      currentPrice: parsedCurrentPrice,
      valueUsd: Number.isFinite(parsedValueUsd) ? parsedValueUsd : 0,
      valueNis: valueNisColumn ? parseNumber(row[valueNisColumn]) : undefined,
      costBasis: Number.isFinite(parsedCostBasis) ? parsedCostBasis : 0,
      earningsPct: earningsPctColumn ? parseNumber(row[earningsPctColumn]) : 0,
      soldDate: soldDateColumn ? normalizeDate(row[soldDateColumn]) : undefined,
      soldPrice: soldPriceColumn ? parseNumber(row[soldPriceColumn]) : undefined,
      stopLossPrice: stopLossColumn ? parseNumber(row[stopLossColumn]) : undefined,
      status,
      finalEarning: finalEarningColumn
        ? parseNumber(row[finalEarningColumn])
        : undefined,
      activeEarning: Number.isFinite(parsedActiveEarning)
        ? parsedActiveEarning
        : undefined,
    });
  });

  return { snapshotRows, errors };
}

export default function SyncSettingsPage() {
  const {
    transactions,
    portfolioSnapshot,
    setTransactions,
    setPortfolioSnapshot,
    setPriceHistory,
    loadDemoData,
    clearLocalData,
  } = usePortfolioData();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [snapshotText, setSnapshotText] = useState("");
  const [snapshotPreview, setSnapshotPreview] = useState<PortfolioSnapshotRow[]>([]);
  const [snapshotErrors, setSnapshotErrors] = useState<string[]>([]);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  const missingRequiredFields = useMemo(
    () => requiredFields.filter((field) => !columnMap[field]),
    [columnMap],
  );

  async function handleFile(file: File) {
    setFileName(file.name);
    setErrors([]);
    setImportMessage("");

    const parsedRows = await parseRowsFromFile(file);
    const parsedHeaders = parsedRows[0] ? Object.keys(parsedRows[0]) : [];

    setRows(parsedRows);
    setHeaders(parsedHeaders);
    setColumnMap(autoMapColumns(parsedHeaders));
  }

  function importRows() {
    setErrors([]);
    setImportMessage("");

    if (missingRequiredFields.length > 0) {
      setErrors([
        `Missing required column mappings: ${missingRequiredFields.join(", ")}.`,
      ]);
      return;
    }

    const result = buildTransactions(rows, columnMap);
    if (result.errors.length > 0) {
      setErrors(result.errors.slice(0, 8));
      return;
    }

    setTransactions(result.transactions);
    setPriceHistory([]);
    setImportMessage(
      `Imported ${result.transactions.length} transactions from ${fileName}. Dashboard values now use this local ledger.`,
    );
  }

  function parseManualSnapshot(text: string) {
    setSnapshotErrors([]);
    setSnapshotMessage("");

    if (!text.trim()) {
      setSnapshotErrors(["Paste your current portfolio table first."]);
      return;
    }

    const result = buildSnapshotRows(parseRowsFromText(text));
    if (result.errors.length > 0) {
      setSnapshotErrors(result.errors.slice(0, 8));
      return;
    }

    setSnapshotPreview(result.snapshotRows);
    setSnapshotMessage(
      `Parsed ${result.snapshotRows.length} portfolio status rows. Review and save when ready.`,
    );
  }

  async function handleSnapshotFile(file: File) {
    setSnapshotErrors([]);
    setSnapshotMessage("");
    const result = buildSnapshotRows(await parseRowsFromFile(file));

    if (result.errors.length > 0) {
      setSnapshotErrors(result.errors.slice(0, 8));
      return;
    }

    setSnapshotPreview(result.snapshotRows);
    setSnapshotMessage(
      `Parsed ${result.snapshotRows.length} portfolio status rows from ${file.name}.`,
    );
  }

  function saveSnapshot() {
    if (snapshotPreview.length === 0) {
      setSnapshotErrors(["Parse a snapshot before saving it."]);
      return;
    }

    setPortfolioSnapshot(snapshotPreview);
    setPriceHistory([]);
    setSnapshotMessage(
      `Saved ${snapshotPreview.length} status rows locally. Active rows now drive Overview, Holdings, and Sectors.`,
    );
  }

  async function updateSavedSnapshotPrices() {
    setSnapshotErrors([]);
    setSnapshotMessage("");

    const activeTickers = Array.from(
      new Set(
        portfolioSnapshot
          .filter((row) => row.status === "Active")
          .map((row) => normalizeTicker(row.ticker))
          .filter(Boolean),
      ),
    );

    if (activeTickers.length === 0) {
      setSnapshotErrors(["Save an active portfolio snapshot before updating prices."]);
      return;
    }

    setIsUpdatingPrices(true);
    const to = new Date().toISOString().slice(0, 10);
    const response = await fetch(
      `/api/price-history?tickers=${encodeURIComponent(activeTickers.join(","))}&from=${twoWeeksAgo()}&to=${to}`,
    );

    if (!response.ok) {
      setIsUpdatingPrices(false);
      setSnapshotErrors(["Could not update prices. Try again later."]);
      return;
    }

    const payload = (await response.json()) as {
      prices: PriceHistoryPoint[];
      errors?: Array<{ ticker: string; error: string }>;
    };
    const latestPrices = new Map<string, PriceHistoryPoint>();

    payload.prices.forEach((point) => {
      const ticker = normalizeTicker(point.ticker);
      const existing = latestPrices.get(ticker);
      if (!existing || point.date > existing.date) {
        latestPrices.set(ticker, point);
      }
    });

    const nextSnapshot = portfolioSnapshot.map((row) => {
      if (row.status !== "Active") return row;

      const latest = latestPrices.get(normalizeTicker(row.ticker));
      if (!latest) return row;

      const valueUsd = row.shares * latest.close;
      const activeEarning = valueUsd - row.costBasis;

      return {
        ...row,
        currentPrice: latest.close,
        valueUsd,
        activeEarning,
        earningsPct: row.costBasis ? (activeEarning / row.costBasis) * 100 : 0,
      };
    });

    setPortfolioSnapshot(nextSnapshot);
    setSnapshotPreview(nextSnapshot);
    setPriceHistory([]);
    setIsUpdatingPrices(false);
    setSnapshotMessage(
      payload.errors?.length
        ? `Updated prices for ${latestPrices.size} tickers. Missing: ${payload.errors.map((error) => error.ticker).join(", ")}.`
        : `Updated current prices for ${latestPrices.size} active tickers and recalculated local snapshot values.`,
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Sync Settings"
        title="Local file import"
        description="Upload a transaction ledger, or paste your current portfolio status table. Everything is stored locally in this browser."
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Current Portfolio Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-gray-50 p-4 text-sm">
              <div className="font-medium">Saved local status</div>
              <div className="mt-1 text-muted-foreground">
                {portfolioSnapshot.length} rows saved. Active rows override the
                transaction ledger for dashboard calculations.
              </div>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-8 text-center hover:bg-gray-50">
              <UploadCloud className="mb-3 h-7 w-7 text-gray-500" />
              <div className="font-medium">Upload current status CSV/XLSX/TSV</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Supports columns like Ticker, Shares, Purchase Price, Current
                Price, Cost Basis, Status, Final Earning, Active Earning.
              </div>
              <input
                type="file"
                accept=".csv,.tsv,.xlsx,.xls"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleSnapshotFile(file);
                }}
              />
            </label>

            <textarea
              value={snapshotText}
              onChange={(event) => setSnapshotText(event.target.value)}
              placeholder="Paste your tab-separated portfolio status table here..."
              className="min-h-44 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => parseManualSnapshot(snapshotText)}
              >
                Parse pasted status
              </Button>
              <Button onClick={saveSnapshot} disabled={snapshotPreview.length === 0}>
                Save status locally
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPortfolioSnapshot([]);
                  setSnapshotPreview([]);
                  setPriceHistory([]);
                  setSnapshotMessage("Cleared the saved status snapshot.");
                }}
              >
                Clear saved status
              </Button>
              <Button
                variant="outline"
                onClick={() => void updateSavedSnapshotPrices()}
                disabled={portfolioSnapshot.length === 0 || isUpdatingPrices}
              >
                {isUpdatingPrices ? "Updating prices..." : "Update current prices"}
              </Button>
            </div>

            {snapshotErrors.length > 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {snapshotErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            ) : null}
            {snapshotMessage ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {snapshotMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshotPreview.length ? (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Purchase</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Value USD</TableHead>
                    <TableHead className="text-right">Active P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshotPreview.slice(0, 8).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-semibold">{row.ticker}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.shares}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${row.purchasePrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${row.currentPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${Math.round(row.valueUsd).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.activeEarning === undefined
                          ? "-"
                          : `$${Math.round(row.activeEarning).toLocaleString()}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
                Upload or paste a current-status table to preview active and
                closed rows before saving.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center hover:bg-gray-50">
              <UploadCloud className="mb-3 h-8 w-8 text-gray-500" />
              <div className="font-medium">Drop in a CSV or XLSX export</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Required fields: date, ticker, action, quantity, price
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </label>

            <div className="rounded-md border bg-gray-50 p-4 text-sm">
              <div className="font-medium">Current local ledger</div>
              <div className="mt-1 text-muted-foreground">
                {transactions.length} transactions stored in this browser.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={importRows}
                disabled={rows.length === 0 || missingRequiredFields.length > 0}
              >
                Import into localStorage
              </Button>
              <Button variant="outline" onClick={loadDemoData}>
                Load demo data
              </Button>
              <Button variant="outline" onClick={clearLocalData}>
                Clear local data
              </Button>
            </div>

            {missingRequiredFields.length > 0 && rows.length > 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Missing mappings: {missingRequiredFields.join(", ")}
              </div>
            ) : null}
            {errors.length > 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            ) : null}
            {importMessage ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {importMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Column Mapping</CardTitle>
          </CardHeader>
          <CardContent>
            {headers.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...requiredFields, ...optionalFields].map((field) => (
                  <label key={field} className="text-sm">
                    <span className="mb-1 block font-medium capitalize">
                      {field}
                      {requiredFields.includes(field as (typeof requiredFields)[number])
                        ? " *"
                        : ""}
                    </span>
                    <select
                      value={columnMap[field] ?? ""}
                      onChange={(event) =>
                        setColumnMap((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Not mapped</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
                Upload a file to preview detected columns.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Preview {fileName ? `- ${fileName}` : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.slice(0, 10).map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 8).map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {headers.slice(0, 10).map((header) => (
                      <TableCell key={header} className="max-w-48 truncate">
                        {String(row[header] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
              No file loaded yet.
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
