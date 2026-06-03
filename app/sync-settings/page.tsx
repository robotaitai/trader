"use client";

import { useMemo, useState } from "react";
import { FileDown, UploadCloud } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { CloudSyncCard } from "@/components/cloud-sync-card";
import { PageHeader } from "@/components/page-header";
import {
  SortableTableHead,
  useSortableData,
} from "@/components/sortable-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
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
  const arrayBuffer = await file.arrayBuffer();
  return XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
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

function latestPricesByTicker(prices: PriceHistoryPoint[]) {
  const latestPrices = new Map<string, PriceHistoryPoint>();

  prices.forEach((point) => {
    const ticker = normalizeTicker(point.ticker);
    const existing = latestPrices.get(ticker);
    if (!existing || point.date > existing.date) {
      latestPrices.set(ticker, point);
    }
  });

  return latestPrices;
}

function updateSnapshotWithLatestPrices(
  snapshotRows: PortfolioSnapshotRow[],
  prices: PriceHistoryPoint[],
) {
  const latestPrices = latestPricesByTicker(prices);

  return snapshotRows.map((row) => {
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

function downloadInvestorOsTemplate() {
  const workbook = XLSX.utils.book_new();
  const portfolioSnapshot = XLSX.utils.json_to_sheet([
    {
      Ticker: "NVDA",
      "Security Type": "Stock",
      Shares: 10,
      "Purchase Date": "2025-01-15",
      "Purchase Price": 100,
      "Current Price": 125,
      "Value USD": 1250,
      "Cost Basis": 1000,
      "Ernings Prct": 25,
      "Sold Date": "",
      "Sold Price": "",
      "Stop Loss Price": "",
      Status: "Active",
      "Final Earning": "",
      "Active Earning": 250,
    },
    {
      Ticker: "VOO",
      "Security Type": "ETF",
      Shares: 5,
      "Purchase Date": "2024-06-03",
      "Purchase Price": 450,
      "Current Price": 500,
      "Value USD": 2500,
      "Cost Basis": 2250,
      "Ernings Prct": 11.11,
      "Sold Date": "",
      "Sold Price": "",
      "Stop Loss Price": "",
      Status: "Active",
      "Final Earning": "",
      "Active Earning": 250,
    },
  ]);
  const transactions = XLSX.utils.json_to_sheet([
    {
      date: "2025-01-15",
      ticker: "NVDA",
      action: "BUY",
      quantity: 10,
      price: 100,
      currency: "USD",
      fees: 0,
      notes: "Optional",
    },
  ]);
  const priceHistory = XLSX.utils.json_to_sheet([
    { date: "2025-01-15", ticker: "NVDA", close: 100 },
    { date: "2025-01-16", ticker: "NVDA", close: 102 },
    { date: "2025-01-15", ticker: "VOO", close: 450 },
    { date: "2025-01-16", ticker: "VOO", close: 452 },
  ]);
  const metadata = XLSX.utils.json_to_sheet([
    {
      ticker: "NVDA",
      name: "NVIDIA Corp.",
      sector: "Semiconductors",
      currency: "USD",
      exchange: "NASDAQ",
    },
  ]);
  const instructions = XLSX.utils.aoa_to_sheet([
    ["Investor OS data template"],
    [""],
    ["Use Portfolio Snapshot for your current holdings/status."],
    ["Use Transactions if you prefer a ledger import."],
    ["Use Price History for GitHub Pages/static mode, where the app cannot call a server API."],
    ["You can ask ChatGPT to convert broker PDFs/statements into these sheets."],
    ["Your uploaded workbook is parsed locally in your browser; this app does not upload it anywhere."],
    [""],
    ["Required Portfolio Snapshot columns: Ticker, Shares, Purchase Price."],
    ["Recommended Portfolio Snapshot columns: Security Type, Purchase Date, Current Price, Value USD, Cost Basis, Status, Sold Date, Sold Price, Final Earning, Active Earning."],
    ["Required Transactions columns: date, ticker, action, quantity, price."],
    ["Valid transaction actions: BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAWAL, FEE, TAX."],
    ["Required Price History columns: date, ticker, close."],
  ]);

  XLSX.utils.book_append_sheet(workbook, portfolioSnapshot, "Portfolio Snapshot");
  XLSX.utils.book_append_sheet(workbook, transactions, "Transactions");
  XLSX.utils.book_append_sheet(workbook, priceHistory, "Price History");
  XLSX.utils.book_append_sheet(workbook, metadata, "Security Metadata");
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  XLSX.writeFile(workbook, "investor-os-template.xlsx");
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
      const response = await fetch(
        `/api/price-history?tickers=${encodeURIComponent(tickers.join(","))}&from=${from}&to=${to}`,
      );

      if (!response.ok) {
        throw new Error("Price history fetch failed.");
      }

      const payload = (await response.json()) as {
        prices: PriceHistoryPoint[];
        errors?: Array<{ ticker: string; error: string }>;
      };

      setPriceHistory(payload.prices);
      return payload;
    } catch {
      setPriceHistory([]);
      onError("Saved locally, but daily price history could not be fetched. Try again later.");
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

  async function handleSnapshotFile(file: File) {
    setSnapshotErrors([]);
    setSnapshotMessage("");
    const workbook = await parseWorkbookFromFile(file);
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

    setSnapshotPreview(result.snapshotRows);
    setSnapshotPriceHistoryPreview(
      priceHistorySheet ? buildPriceHistoryRows(sheetRows(workbook, priceHistorySheet)) : [],
    );
    setSnapshotMessage(
      `Parsed ${result.snapshotRows.length} portfolio status rows from ${file.name}${
        result.skippedRows ? ` and skipped ${result.skippedRows} blank template rows` : ""
      }${
        priceHistorySheet ? " Price history sheet detected." : ""
      }.`,
    );
  }

  async function saveSnapshot() {
    if (snapshotPreview.length === 0) {
      setSnapshotErrors(["Parse a snapshot before saving it."]);
      return;
    }

    setPortfolioSnapshot(snapshotPreview);
    if (snapshotPriceHistoryPreview.length > 0) {
      const nextSnapshot = updateSnapshotWithLatestPrices(
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
      const nextSnapshot = updateSnapshotWithLatestPrices(
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
    const latestPrices = latestPricesByTicker(payload.prices);

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
    setPriceHistory(payload.prices);
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

      <CloudSyncCard />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>How to Add Private Data</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>
              Download the Investor OS workbook, fill it in Excel or Google
              Sheets, then upload it here. You can also give broker PDFs or
              statements to ChatGPT and ask it to convert them into this
              workbook format.
            </p>
            <p>
              For GitHub Pages/static hosting, include the optional Price
              History sheet so Daily and Weekly performance can work without a
              server API. The file is parsed locally in your browser and is not
              uploaded to Investor OS.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2"
            onClick={downloadInvestorOsTemplate}
          >
            <FileDown className="h-4 w-4" />
            Download Investor OS workbook
          </Button>
        </CardContent>
      </Card>

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
                {isFetchingHistory ? "Saving + fetching..." : "Save status locally"}
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
                disabled={portfolioSnapshot.length === 0 || isUpdatingPrices || isFetchingHistory}
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
                    <SortableTableHead id="ticker" label="Ticker" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                    <SortableTableHead id="status" label="Status" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                    <SortableTableHead id="shares" label="Shares" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                    <SortableTableHead id="purchasePrice" label="Purchase" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                    <SortableTableHead id="currentPrice" label="Current" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                    <SortableTableHead id="valueUsd" label="Value USD" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                    <SortableTableHead id="activeEarning" label="Active P&L" align="right" sortConfig={snapshotPreviewSortConfig} onSort={toggleSnapshotPreviewSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSnapshotPreview.slice(0, 8).map((row) => (
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
    </AppShell>
  );
}
