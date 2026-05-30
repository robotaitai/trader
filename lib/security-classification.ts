import type { SecurityMetadata } from "@/lib/types";

const knownSecurityMetadata: Record<string, SecurityMetadata> = {
  AAPL: {
    ticker: "AAPL",
    name: "Apple Inc.",
    sector: "Technology",
    currency: "USD",
    exchange: "NASDAQ",
  },
  GOOGL: {
    ticker: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Communication Services",
    currency: "USD",
    exchange: "NASDAQ",
  },
  JNJ: {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    sector: "Healthcare",
    currency: "USD",
    exchange: "NYSE",
  },
  JPM: {
    ticker: "JPM",
    name: "JPMorgan Chase & Co.",
    sector: "Financials",
    currency: "USD",
    exchange: "NYSE",
  },
  MSFT: {
    ticker: "MSFT",
    name: "Microsoft Corp.",
    sector: "Technology",
    currency: "USD",
    exchange: "NASDAQ",
  },
  MU: {
    ticker: "MU",
    name: "Micron Technology Inc.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NASDAQ",
  },
  NVDA: {
    ticker: "NVDA",
    name: "NVIDIA Corp.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NASDAQ",
  },
  PLTR: {
    ticker: "PLTR",
    name: "Palantir Technologies Inc.",
    sector: "Software",
    currency: "USD",
    exchange: "NYSE",
  },
  POET: {
    ticker: "POET",
    name: "POET Technologies Inc.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NASDAQ",
  },
  PG: {
    ticker: "PG",
    name: "Procter & Gamble Co.",
    sector: "Consumer Staples",
    currency: "USD",
    exchange: "NYSE",
  },
  QQQ: {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    sector: "Growth Index",
    currency: "USD",
    exchange: "NASDAQ",
  },
  SCHD: {
    ticker: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    sector: "Dividend Equity",
    currency: "USD",
    exchange: "NYSEARCA",
  },
  SPY: {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    sector: "Broad Market",
    currency: "USD",
    exchange: "NYSEARCA",
  },
  TSM: {
    ticker: "TSM",
    name: "Taiwan Semiconductor Manufacturing Co.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NYSE",
  },
  VOO: {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    sector: "Broad Market",
    currency: "USD",
    exchange: "NYSEARCA",
  },
  XOM: {
    ticker: "XOM",
    name: "Exxon Mobil Corp.",
    sector: "Energy",
    currency: "USD",
    exchange: "NYSE",
  },
};

export function normalizeTicker(ticker: string) {
  return ticker
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/[^A-Z0-9.-]/g, "");
}

export function inferSecurityMetadata(
  ticker: string,
  securityType?: string,
): SecurityMetadata {
  const normalizedTicker = normalizeTicker(ticker);
  const known = knownSecurityMetadata[normalizedTicker];
  if (known) return known;

  const normalizedType = securityType?.trim().toLowerCase();
  const sector =
    normalizedType === "etf"
      ? "Diversified Fund"
      : normalizedType === "stock"
        ? "Unclassified Equity"
        : "Unclassified";

  return {
    ticker: normalizedTicker,
    name: normalizedTicker,
    sector,
    currency: "USD",
    exchange: "Manual",
  };
}

export const curatedSecurityMetadata = Object.values(knownSecurityMetadata);
