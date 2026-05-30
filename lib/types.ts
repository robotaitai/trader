export type TransactionAction =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "FEE"
  | "TAX";

export type Transaction = {
  id: string;
  date: string;
  ticker: string;
  action: TransactionAction;
  quantity: number;
  price: number;
  currency: string;
  fees: number;
  notes?: string;
};

export type SecurityMetadata = {
  ticker: string;
  name: string;
  sector: string;
  currency: string;
  exchange: string;
};

export type Holding = {
  ticker: string;
  name: string;
  sector: string;
  currency: string;
  exchange: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  weightPct: number;
  firstBuyDate: string;
  lastActionDate: string;
};

export type ClosedPosition = {
  ticker: string;
  name: string;
  sector: string;
  securityType: string;
  quantity: number;
  purchaseDate?: string;
  purchasePrice: number;
  costBasis: number;
  soldDate?: string;
  soldPrice?: number;
  proceeds: number;
  realizedPnl: number;
  realizedPnlPct: number;
};

export type PortfolioSnapshotStatus = "Active" | "Closed";

export type PortfolioSnapshotRow = {
  id: string;
  ticker: string;
  securityType: string;
  shares: number;
  purchaseDate?: string;
  purchasePrice: number;
  currentPrice: number;
  valueUsd: number;
  valueNis?: number;
  costBasis: number;
  earningsPct: number;
  soldDate?: string;
  soldPrice?: number;
  stopLossPrice?: number;
  status: PortfolioSnapshotStatus;
  finalEarning?: number;
  activeEarning?: number;
};

export type PortfolioSummary = {
  portfolioValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  estimatedXirr: string;
  hhi: number;
};

export type SectorExposure = {
  sector: string;
  value: number;
  costBasis: number;
  unrealizedPnl: number;
  weightPct: number;
  positions: number;
};

export type WinnerLoser = {
  ticker: string;
  name: string;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};

export type MonthlyPerformancePoint = {
  month: string;
  label: string;
  dataSource: "estimated" | "daily-prices";
  startingValue: number;
  endingValue: number;
  netFlow: number;
  gainLoss: number;
  returnPct: number;
};

export type PriceHistoryPoint = {
  ticker: string;
  date: string;
  close: number;
};
