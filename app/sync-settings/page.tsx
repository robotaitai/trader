"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileDown, UploadCloud } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { FileSyncCard } from "@/components/file-sync-card";
import { PageHeader } from "@/components/page-header";
import {
  SortableTableHead,
  useSortableData,
} from "@/components/sortable-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchDailyCloses } from "@/lib/market-data";
import { applyLatestCloses } from "@/lib/performance-metrics";
import { downloadProcessedData } from "@/lib/portfolio-bundle";
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

const priceHistoryAliases: Record<string, string[]> = {
  ticker: ["ticker", "symbol"],
  date: ["date", "pricedate", "tradingdate"],
  close: ["close", "adjustedclose", "adjclose", "price", "currentprice"],
};

function findColumn(row: RawRow, field: string) {
  const aliases = snapshotAliases[field];
  return Object.keys(row).find((key) => aliases.includes(normalizeHeader(key)));
}

function findPriceHistoryColumn(row: RawRow, field: string) {
  const aliases = priceHistoryAliases[field];
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

function sheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });
}

function findSheetName(workbook: XLSX.WorkBook, candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return workbook.SheetNames.find((sheetName) =>
    normalizedCandidates.includes(normalizeHeader(sheetName)),
  );
}

async function parseWorkbookFromFile(file: File) {
  const name = file.name.toLowerCase();
  const looksLikeText =
    /\.(csv|tsv|txt)$/.test(name) ||
    file.type === "text/csv" ||
    file.type === "text/tab-separated-values" ||
    file.type === "text/plain";

  // Read text files as strings so SheetJS can sniff the delimiter (handles
  // comma, tab, and the semicolon CSVs that European Excel exports). Binary
  // formats (.xlsx/.xls) are read as an array buffer.
  if (looksLikeText) {
    const text = await file.text();
    return XLSX.read(text, { type: "string", cellDates: true, raw: false });
  }
  const arrayBuffer = await file.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: "array", cellDates: true });
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

function threeYearsAgo() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 3);
  return date.toISOString().slice(0, 10);
}

function uniqueTickers(values: string[]) {
  return Array.from(new Set(values.map(normalizeTicker).filter(Boolean)));
}

function snapshotTickers(snapshotRows: PortfolioSnapshotRow[]) {
  return uniqueTickers(snapshotRows.map((row) => row.ticker));
}

function transactionTickers(transactions: Transaction[]) {
  return uniqueTickers(transactions.map((transaction) => transaction.ticker));
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

  return (dates[0] ?? new Date(threeYearsAgo())).toISOString().slice(0, 10);
}

function buildPriceHistoryRows(rows: RawRow[]) {
  const prices: PriceHistoryPoint[] = [];

  rows.forEach((row) => {
    const tickerColumn = findPriceHistoryColumn(row, "ticker");
    const dateColumn = findPriceHistoryColumn(row, "date");
    const closeColumn = findPriceHistoryColumn(row, "close");
    const ticker = tickerColumn
      ? normalizeTicker(String(row[tickerColumn] ?? ""))
      : "";
    const date = dateColumn ? normalizeDate(row[dateColumn]) : "";
    const close = closeColumn ? parseNumber(row[closeColumn]) : NaN;

    if (!ticker && !date && !Number.isFinite(close)) return;
    if (!ticker || !date || !Number.isFinite(close)) return;

    prices.push({ ticker, date, close });
  });

  return prices;
}

function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

// Simple, human-friendly CSV: one row per holding. Status, value, cost basis,
// and profit/loss are all computed by the app, so they are not asked for here.
// Leave the Sell columns blank while you still hold a position; filling either
// one marks the row as closed.
function downloadInvestorOsTemplate() {
  const sheet = XLSX.utils.json_to_sheet(
    [
      {
        Ticker: "NVDA",
        Shares: 10,
        "Buy Price": 100,
        "Buy Date": "2025-01-15",
        "Current Price": 125,
        "Sell Price": "",
        "Sell Date": "",
      },
      {
        Ticker: "AAPL",
        Shares: 5,
        "Buy Price": 150,
        "Buy Date": "2024-03-10",
        "Current Price": "",
        "Sell Price": 190,
        "Sell Date": "2025-02-01",
      },
    ],
    {
      header: [
        "Ticker",
        "Shares",
        "Buy Price",
        "Buy Date",
        "Current Price",
        "Sell Price",
        "Sell Date",
      ],
    },
  );
  downloadTextFile(
    XLSX.utils.sheet_to_csv(sheet),
    "investor-os-template.csv",
    "text/csv;charset=utf-8",
  );
}

function buildSnapshotRows(rows: RawRow[]) {
  const errors: string[] = [];
  let skippedRows = 0;
  const importedAt = Date.now();
  const snapshotRows: PortfolioSnapshotRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const tickerColumn = findColumn(row, "ticker");
    const sharesColumn = findColumn(row, "shares");
    const purchasePriceColumn = findColumn(row, "purchasePrice");
    const currentPriceColumn = findColumn(row, "currentPrice");
    const statusColumn = findColumn(row, "status");

    const rawTicker = tickerColumn ? String(row[tickerColumn] ?? "").trim() : "";
    const rawShares = sharesColumn ? String(row[sharesColumn] ?? "").trim() : "";
    const rawPurchasePrice = purchasePriceColumn
      ? String(row[purchasePriceColumn] ?? "").trim()
      : "";
    const isTemplateRow = !rawTicker && !rawShares && !rawPurchasePrice;

    if (isTemplateRow) {
      skippedRows += 1;
      return;
    }

    const ticker = tickerColumn
      ? normalizeTicker(rawTicker)
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

  return { snapshotRows, errors, skippedRows };
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
  const [transactionPriceHistoryPreview, setTransactionPriceHistoryPreview] =
    useState<PriceHistoryPoint[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [snapshotText, setSnapshotText] = useState("");
  const [snapshotPreview, setSnapshotPreview] = useState<PortfolioSnapshotRow[]>([]);
  const [snapshotPriceHistoryPreview, setSnapshotPriceHistoryPreview] =
    useState<PriceHistoryPoint[]>([]);
  const [snapshotErrors, setSnapshotErrors] = useState<string[]>([]);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const missingRequiredFields = useMemo(
    () => requiredFields.filter((field) => !columnMap[field]),
    [columnMap],
  );
  const rawPreviewHeaders = headers.slice(0, 10);
  const {
    sortedData: sortedSnapshotPreview,
    sortConfig: snapshotPreviewSortConfig,
    toggleSort: toggleSnapshotPreviewSort,
  } = useSortableData(
    snapshotPreview,
    [
      { id: "ticker", getValue: (row) => row.ticker },
      { id: "status", getValue: (row) => row.status },
      { id: "shares", getValue: (row) => row.shares },
      { id: "purchasePrice", getValue: (row) => row.purchasePrice },
      { id: "currentPrice", getValue: (row) => row.currentPrice },
      { id: "valueUsd", getValue: (row) => row.valueUsd },
      { id: "activeEarning", getValue: (row) => row.activeEarning ?? 0 },
    ],
    { id: "ticker", direction: "asc" },
  );
  const {
    sortedData: sortedRawPreviewRows,
    sortConfig: rawPreviewSortConfig,
    toggleSort: toggleRawPreviewSort,
  } = useSortableData(
    rows,
    rawPreviewHeaders.map((header) => ({
      id: header,
      getValue: (row) => String(row[header] ?? ""),
    })),
    { id: rawPreviewHeaders[0] ?? "", direction: "asc" },
  );

  async function handleFile(file: File) {
    setFileName(file.name);
    setErrors([]);
    setImportMessage("");

    const workbook = await parseWorkbookFromFile(file);
    const transactionsSheet =
      findSheetName(workbook, ["Transactions", "Transaction Ledger"]) ??
      workbook.SheetNames[0];
    const priceHistorySheet = findSheetName(workbook, [
      "Price History",
      "Prices",
      "Daily Prices",
    ]);
    const parsedRows = sheetRows(workbook, transactionsSheet);
    const parsedHeaders = parsedRows[0] ? Object.keys(parsedRows[0]) : [];

    setRows(parsedRows);
    setHeaders(parsedHeaders);
    setColumnMap(autoMapColumns(parsedHeaders));
    setTransactionPriceHistoryPreview(
      priceHistorySheet ? buildPriceHistoryRows(sheetRows(workbook, priceHistorySheet)) : [],
    );
  }

  async function fetchAndStoreDailyHistory(
    tickers: string[],
    from: string,
    onError: (message: string) => void,
  ) {
    if (tickers.length === 0) return null;

    setIsFetchingHistory(true);
    const to = new Date().toISOString().slice(0, 10);

    try {
      // Fetched in the browser from Yahoo Finance (only ticker symbols are
      // sent). Works on the static GitHub Pages site with no server.
      const { prices, failed } = await fetchDailyCloses(tickers, from, to);
      if (prices.length === 0) {
        throw new Error("No prices returned.");
      }
      setPriceHistory(prices);
      return {
        prices,
        errors: failed.map((ticker) => ({ ticker, error: "not found" })),
      };
    } catch {
      setPriceHistory([]);
      onError(
        "Saved locally, but live prices could not be fetched right now. You can retry, or add a Current Price column.",
      );
      return null;
    } finally {
      setIsFetchingHistory(false);
    }
  }

  async function importRows() {
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
    if (transactionPriceHistoryPreview.length > 0) {
      setPriceHistory(transactionPriceHistoryPreview);
      setImportMessage(
        `Imported ${result.transactions.length} transactions from ${fileName} and loaded ${transactionPriceHistoryPreview.length.toLocaleString()} local price-history rows from the workbook.`,
      );
      return;
    }

    setImportMessage(
      `Imported ${result.transactions.length} transactions from ${fileName}. Fetching daily price history...`,
    );
    const payload = await fetchAndStoreDailyHistory(
      transactionTickers(result.transactions),
      findEarliestPortfolioDate(result.transactions, []),
      (message) => setImportMessage(message),
    );

    if (payload) {
      setImportMessage(
        payload.errors?.length
          ? `Imported ${result.transactions.length} transactions and fetched ${payload.prices.length.toLocaleString()} daily prices. Missing: ${payload.errors.map((error) => error.ticker).join(", ")}.`
          : `Imported ${result.transactions.length} transactions and fetched ${payload.prices.length.toLocaleString()} daily prices. Overview now uses market history.`,
      );
    }
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
    setSnapshotPriceHistoryPreview([]);
    setSnapshotMessage(
      `Parsed ${result.snapshotRows.length} portfolio status rows${
        result.skippedRows ? ` and skipped ${result.skippedRows} blank template rows` : ""
      }. Review and save when ready.`,
    );
  }

  // Friendly one-step import used by the guided flow: read the file, then save
  // it straight to the device (no extra "Save" click, no blocking network
  // fetch) so the dashboard updates immediately.
  async function importPortfolioFile(file: File) {
    setSnapshotErrors([]);
    setSnapshotMessage("");
    setIsDragging(false);
    let workbook: XLSX.WorkBook;
    try {
      workbook = await parseWorkbookFromFile(file);
    } catch {
      setSnapshotErrors([
        `Could not read "${file.name}". Please upload a CSV or Excel file (the downloaded template works as-is).`,
      ]);
      return;
    }

    const snapshotSheet =
      findSheetName(workbook, ["Portfolio Snapshot", "Snapshot", "Holdings"]) ??
      workbook.SheetNames[0];
    const priceHistorySheet = findSheetName(workbook, [
      "Price History",
      "Prices",
      "Daily Prices",
    ]);
    const result = buildSnapshotRows(sheetRows(workbook, snapshotSheet));

    if (result.errors.length > 0) {
      setSnapshotErrors(result.errors.slice(0, 8));
      return;
    }
    if (result.snapshotRows.length === 0) {
      setSnapshotErrors([
        "No holdings found. Make sure your file has Ticker, Shares, and Buy Price columns with at least one row.",
      ]);
      return;
    }

    const filePriceHistory = priceHistorySheet
      ? buildPriceHistoryRows(sheetRows(workbook, priceHistorySheet))
      : [];
    let savedRows =
      filePriceHistory.length > 0
        ? applyLatestCloses(result.snapshotRows, filePriceHistory)
        : result.snapshotRows;

    setPortfolioSnapshot(savedRows);
    setSnapshotPreview(savedRows);
    if (filePriceHistory.length > 0) setPriceHistory(filePriceHistory);

    const count = savedRows.length;
    setSnapshotMessage(
      `Imported ${count} holding${count === 1 ? "" : "s"} from "${file.name}". Fetching live daily prices...`,
    );

    // Auto-process: fetch live daily history so the dashboard's daily/weekly
    // views and current prices light up immediately. Failures are non-fatal —
    // the holdings are already saved above.
    if (filePriceHistory.length === 0) {
      const tickers = savedRows
        .filter((row) => row.status === "Active")
        .map((row) => row.ticker);
      const from = findEarliestPortfolioDate([], savedRows);
      const fetched = await fetchAndStoreDailyHistory(tickers, from, (message) =>
        setSnapshotMessage(`Imported ${count} holdings. ${message}`),
      );
      if (fetched && fetched.prices.length > 0) {
        savedRows = applyLatestCloses(savedRows, fetched.prices);
        setPortfolioSnapshot(savedRows);
        setSnapshotPreview(savedRows);
        const missing = fetched.errors.map((error) => error.ticker);
        setSnapshotMessage(
          missing.length
            ? `Imported ${count} holdings and fetched live prices (couldn't find: ${missing.join(", ")}).`
            : `Imported ${count} holdings and fetched live daily prices.`,
        );
      }
    }
  }

  async function saveSnapshot() {
    if (snapshotPreview.length === 0) {
      setSnapshotErrors(["Parse a snapshot before saving it."]);
      return;
    }

    setPortfolioSnapshot(snapshotPreview);
    if (snapshotPriceHistoryPreview.length > 0) {
      const nextSnapshot = applyLatestCloses(
        snapshotPreview,
        snapshotPriceHistoryPreview,
      );

      setPortfolioSnapshot(nextSnapshot);
      setSnapshotPreview(nextSnapshot);
      setPriceHistory(snapshotPriceHistoryPreview);
      setSnapshotMessage(
        `Saved ${nextSnapshot.length} status rows and loaded ${snapshotPriceHistoryPreview.length.toLocaleString()} local price-history rows from the workbook.`,
      );
      return;
    }

    setSnapshotMessage(
      `Saved ${snapshotPreview.length} status rows locally. Fetching daily price history...`,
    );
    const payload = await fetchAndStoreDailyHistory(
      snapshotTickers(snapshotPreview),
      findEarliestPortfolioDate([], snapshotPreview),
      (message) => setSnapshotMessage(message),
    );

    if (payload) {
      const nextSnapshot = applyLatestCloses(
        snapshotPreview,
        payload.prices,
      );

      setPortfolioSnapshot(nextSnapshot);
      setSnapshotPreview(nextSnapshot);
      setSnapshotMessage(
        payload.errors?.length
          ? `Saved ${nextSnapshot.length} status rows and fetched ${payload.prices.length.toLocaleString()} daily prices. Missing: ${payload.errors.map((error) => error.ticker).join(", ")}.`
          : `Saved ${nextSnapshot.length} status rows and fetched ${payload.prices.length.toLocaleString()} daily prices. Overview now uses market history.`,
      );
    }
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
    const { prices, failed } = await fetchDailyCloses(
      activeTickers,
      twoWeeksAgo(),
      to,
    );

    if (prices.length === 0) {
      setIsUpdatingPrices(false);
      setSnapshotErrors([
        "Could not fetch live prices right now. Please try again in a moment.",
      ]);
      return;
    }

    const nextSnapshot = applyLatestCloses(portfolioSnapshot, prices);
    const updatedCount = activeTickers.length - failed.length;

    setPortfolioSnapshot(nextSnapshot);
    setSnapshotPreview(nextSnapshot);
    setPriceHistory(prices);
    setIsUpdatingPrices(false);
    setSnapshotMessage(
      failed.length
        ? `Updated prices for ${updatedCount} tickers. Could not find: ${failed.join(", ")}.`
        : `Updated live prices for ${updatedCount} active tickers and recalculated values.`,
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Portfolio"
        title="Add your portfolio"
        description="Import your holdings from a simple file. Everything stays on your device — nothing is uploaded."
      />

      {/* Guided, friendly import flow */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>📈 Add your portfolio in 3 steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 — download */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              1
            </div>
            <div className="space-y-2">
              <div className="font-medium">📥 Download the template</div>
              <p className="text-sm text-muted-foreground">
                A simple CSV — one row per holding. Opens in Excel, Google
                Sheets, Numbers, or any text editor.
              </p>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={downloadInvestorOsTemplate}
              >
                <FileDown className="h-4 w-4" />
                Download CSV template
              </Button>
            </div>
          </div>

          {/* Step 2 — fill */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              2
            </div>
            <div className="space-y-1">
              <div className="font-medium">✍️ Fill in your holdings</div>
              <p className="text-sm text-muted-foreground">
                Required: <strong>Ticker</strong>, <strong>Shares</strong>,{" "}
                <strong>Buy Price</strong>. Add <strong>Sell Price</strong> /{" "}
                <strong>Sell Date</strong> when you sell — value, profit/loss,
                and active vs closed are calculated for you.
              </p>
              <p className="text-xs text-muted-foreground">
                💡 Tip: paste a broker statement into ChatGPT and ask it to fill
                the template.
              </p>
            </div>
          </div>

          {/* Step 3 — upload */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              3
            </div>
            <div className="flex-1 space-y-2">
              <div className="font-medium">📤 Upload it back here</div>
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) void importPortfolioFile(file);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <UploadCloud className="mb-3 h-9 w-9 text-gray-500" />
                <div className="font-medium">
                  Drag your file here, or tap to choose
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  CSV, TSV, or Excel — saved on this device only, never
                  uploaded.
                </div>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/plain"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importPortfolioFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* Feedback */}
          {snapshotErrors.length > 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="font-medium">⚠️ We couldn’t import that file</div>
              {snapshotErrors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          ) : null}

          {portfolioSnapshot.length > 0 ? (
            <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  ✅ {snapshotMessage ||
                    `${portfolioSnapshot.length} holding${portfolioSnapshot.length === 1 ? "" : "s"} saved on this device.`}
                </div>
                <Link
                  href="/overview"
                  className={buttonVariants({ className: "gap-2 shrink-0" })}
                >
                  View your dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex flex-col gap-2 border-t border-emerald-200 pt-3 text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5">
                  🔒 Nothing is stored on any server — this data lives only in
                  this browser. Save a copy so you can reload it instantly next
                  time (and on your other devices).
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 gap-2 border-emerald-300 bg-white"
                  onClick={() => downloadProcessedData()}
                >
                  <FileDown className="h-4 w-4" />
                  Download processed data
                </Button>
              </div>
            </div>
          ) : snapshotMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {snapshotMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Imported holdings preview */}
      {snapshotPreview.length > 0 ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Imported holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <SortableTableHead id="ticker" label="Ticker" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                  <SortableTableHead id="status" label="Status" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                  <SortableTableHead id="shares" label="Shares" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                  <SortableTableHead id="purchasePrice" label="Buy" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                  <SortableTableHead id="currentPrice" label="Current" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                  <SortableTableHead id="valueUsd" label="Value" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                  <SortableTableHead id="activeEarning" label="P&L" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSnapshotPreview.slice(0, 8).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold">{row.ticker}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.shares}</TableCell>
                    <TableCell className="text-right tabular-nums">${row.purchasePrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">${row.currentPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">${Math.round(row.valueUsd).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.activeEarning === undefined ? "-" : `$${Math.round(row.activeEarning).toLocaleString()}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* Multi-device sync (optional) */}
      <FileSyncCard />

      {/* Advanced (optional) */}
      <details className="mb-5 rounded-lg border bg-card text-card-foreground shadow-sm">
        <summary className="cursor-pointer px-6 py-4 font-medium [&::-webkit-details-marker]:hidden">
          ⚙️ Advanced — paste a table, update prices, or import a transactions ledger
        </summary>
        <div className="space-y-6 border-t px-6 py-5">
          {/* Paste / manage holdings */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Paste a holdings table</div>
            <p className="text-xs text-muted-foreground">
              Copy rows from a spreadsheet (tab- or comma-separated) and paste
              them here, then parse and save.
            </p>
            <textarea
              value={snapshotText}
              onChange={(event) => setSnapshotText(event.target.value)}
              placeholder="Ticker  Shares  Buy Price  Buy Date  Current Price"
              className="min-h-36 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => parseManualSnapshot(snapshotText)}
              >
                Parse pasted table
              </Button>
              <Button onClick={saveSnapshot} disabled={snapshotPreview.length === 0}>
                {isFetchingHistory ? "Saving..." : "Save pasted table"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void updateSavedSnapshotPrices()}
                disabled={
                  portfolioSnapshot.length === 0 ||
                  isUpdatingPrices ||
                  isFetchingHistory
                }
              >
                {isUpdatingPrices ? "Updating prices..." : "Update current prices"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPortfolioSnapshot([]);
                  setSnapshotPreview([]);
                  setPriceHistory([]);
                  setSnapshotMessage("Cleared all saved holdings.");
                }}
              >
                Clear all holdings
              </Button>
            </div>
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
                onClick={() => void importRows()}
                disabled={
                  rows.length === 0 ||
                  missingRequiredFields.length > 0 ||
                  isFetchingHistory
                }
              >
                {isFetchingHistory ? "Importing + fetching..." : "Import into localStorage"}
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
                  {rawPreviewHeaders.map((header) => (
                    <SortableTableHead
                      key={header}
                      id={header}
                      label={header}
                      sortConfig={rawPreviewSortConfig}
                      onSort={toggleRawPreviewSort}
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRawPreviewRows.slice(0, 8).map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {rawPreviewHeaders.map((header) => (
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
        </div>
      </details>
    </AppShell>
  );
}
