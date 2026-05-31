import type { SecurityMetadata } from "@/lib/types";

const knownSecurityMetadata: Record<string, SecurityMetadata> = {
  AAOI: {
    ticker: "AAOI",
    name: "Applied Optoelectronics Inc.",
    sector: "Communications Equipment",
    currency: "USD",
    exchange: "NASDAQ",
  },
  AAPL: {
    ticker: "AAPL",
    name: "Apple Inc.",
    sector: "Technology",
    currency: "USD",
    exchange: "NASDAQ",
  },
  ACHR: {
    ticker: "ACHR",
    name: "Archer Aviation Inc.",
    sector: "Aerospace & Defense",
    currency: "USD",
    exchange: "NYSE",
  },
  AMD: {
    ticker: "AMD",
    name: "Advanced Micro Devices Inc.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NASDAQ",
  },
  AMZN: {
    ticker: "AMZN",
    name: "Amazon.com Inc.",
    sector: "Consumer Discretionary",
    currency: "USD",
    exchange: "NASDAQ",
  },
  ARBE: {
    ticker: "ARBE",
    name: "Arbe Robotics Ltd.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NASDAQ",
  },
  ASTS: {
    ticker: "ASTS",
    name: "AST SpaceMobile Inc.",
    sector: "Telecommunication Services",
    currency: "USD",
    exchange: "NASDAQ",
  },
  AVGO: {
    ticker: "AVGO",
    name: "Broadcom Inc.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NASDAQ",
  },
  BE: {
    ticker: "BE",
    name: "Bloom Energy Corp.",
    sector: "Clean Energy Equipment",
    currency: "USD",
    exchange: "NYSE",
  },
  FIG: {
    ticker: "FIG",
    name: "Figma Inc.",
    sector: "Software",
    currency: "USD",
    exchange: "NYSE",
  },
  GOOGL: {
    ticker: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Communication Services",
    currency: "USD",
    exchange: "NASDAQ",
  },
  GRAL: {
    ticker: "GRAL",
    name: "GRAIL Inc.",
    sector: "Healthcare Diagnostics",
    currency: "USD",
    exchange: "NASDAQ",
  },
  HIMS: {
    ticker: "HIMS",
    name: "Hims & Hers Health Inc.",
    sector: "Healthcare",
    currency: "USD",
    exchange: "NYSE",
  },
  IBIT: {
    ticker: "IBIT",
    name: "iShares Bitcoin Trust ETF",
    sector: "Bitcoin",
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
  MBLY: {
    ticker: "MBLY",
    name: "Mobileye Global Inc.",
    sector: "Auto Technology",
    currency: "USD",
    exchange: "NASDAQ",
  },
  META: {
    ticker: "META",
    name: "Meta Platforms Inc.",
    sector: "Communication Services",
    currency: "USD",
    exchange: "NASDAQ",
  },
  MSTY: {
    ticker: "MSTY",
    name: "YieldMax MSTR Option Income Strategy ETF",
    sector: "Options Income",
    currency: "USD",
    exchange: "NYSEARCA",
  },
  MU: {
    ticker: "MU",
    name: "Micron Technology Inc.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NASDAQ",
  },
  NASA: {
    ticker: "NASA",
    name: "Space Economy ETF",
    sector: "Space & Defense Fund",
    currency: "USD",
    exchange: "NYSEARCA",
  },
  NBIS: {
    ticker: "NBIS",
    name: "Nebius Group N.V.",
    sector: "Cloud Infrastructure",
    currency: "USD",
    exchange: "NASDAQ",
  },
  NNE: {
    ticker: "NNE",
    name: "Nano Nuclear Energy Inc.",
    sector: "Nuclear Energy",
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
  OKLO: {
    ticker: "OKLO",
    name: "Oklo Inc.",
    sector: "Nuclear Energy",
    currency: "USD",
    exchange: "NYSE",
  },
  ONDS: {
    ticker: "ONDS",
    name: "Ondas Holdings Inc.",
    sector: "Aerospace & Defense",
    currency: "USD",
    exchange: "NASDAQ",
  },
  ORCL: {
    ticker: "ORCL",
    name: "Oracle Corp.",
    sector: "Software",
    currency: "USD",
    exchange: "NYSE",
  },
  OUST: {
    ticker: "OUST",
    name: "Ouster Inc.",
    sector: "Electronic Components",
    currency: "USD",
    exchange: "NYSE",
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
  QQQM: {
    ticker: "QQQM",
    name: "Invesco NASDAQ 100 ETF",
    sector: "Growth Index",
    currency: "USD",
    exchange: "NASDAQ",
  },
  QUBT: {
    ticker: "QUBT",
    name: "Quantum Computing Inc.",
    sector: "Quantum Computing",
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
  TE: {
    ticker: "TE",
    name: "T1 Energy Inc.",
    sector: "Clean Energy Equipment",
    currency: "USD",
    exchange: "NYSE",
  },
  TEM: {
    ticker: "TEM",
    name: "Tempus AI Inc.",
    sector: "Healthcare Technology",
    currency: "USD",
    exchange: "NASDAQ",
  },
  TSLA: {
    ticker: "TSLA",
    name: "Tesla Inc.",
    sector: "Automobiles",
    currency: "USD",
    exchange: "NASDAQ",
  },
  TSM: {
    ticker: "TSM",
    name: "Taiwan Semiconductor Manufacturing Co.",
    sector: "Semiconductors",
    currency: "USD",
    exchange: "NYSE",
  },
  USAR: {
    ticker: "USAR",
    name: "USA Rare Earth Inc.",
    sector: "Materials",
    currency: "USD",
    exchange: "NASDAQ",
  },
  VOO: {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    sector: "Broad Market",
    currency: "USD",
    exchange: "NYSEARCA",
  },
  VST: {
    ticker: "VST",
    name: "Vistra Corp.",
    sector: "Utilities",
    currency: "USD",
    exchange: "NYSE",
  },
  XOM: {
    ticker: "XOM",
    name: "Exxon Mobil Corp.",
    sector: "Energy",
    currency: "USD",
    exchange: "NYSE",
  },
};

export const fundExposureBuckets = new Set([
  "Bitcoin",
  "Broad Market",
  "Diversified Fund",
  "Dividend Equity",
  "Growth Index",
  "Options Income",
  "Space & Defense Fund",
]);

export function isFundExposureBucket(sector: string) {
  return fundExposureBuckets.has(sector);
}

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
