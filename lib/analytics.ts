import type {
  ClosedPosition,
  Holding,
  PortfolioSnapshotRow,
  PortfolioSummary,
  SecurityMetadata,
  SectorExposure,
  Transaction,
  WinnerLoser,
} from "@/lib/types";
import {
  inferSecurityMetadata,
  normalizeTicker,
} from "@/lib/security-classification";

type PositionAccumulator = {
  ticker: string;
  quantity: number;
  costBasis: number;
  lastTradePrice: number;
  firstBuyDate: string;
  lastActionDate: string;
};

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const nonSectorLabels = new Set(["stock", "etf", "fund"]);

function isSnapshotClosed(row: PortfolioSnapshotRow) {
  return (
    row.status === "Closed" ||
    Boolean(row.soldDate) ||
    Boolean(row.soldPrice) ||
    Boolean(row.finalEarning)
  );
}

function resolveSecurity(
  ticker: string,
  securityMetadata: SecurityMetadata[],
  securityType?: string,
) {
  const normalizedTicker = normalizeTicker(ticker);
  const metadataByTicker = new Map(
    securityMetadata.map((security) => [
      normalizeTicker(security.ticker),
      security,
    ]),
  );
  const inferred = inferSecurityMetadata(normalizedTicker, securityType);
  const metadata = metadataByTicker.get(normalizedTicker);
  const metadataSector = metadata?.sector?.trim();
  const sector =
    metadataSector && !nonSectorLabels.has(metadataSector.toLowerCase())
      ? metadataSector
      : inferred.sector;

  return {
    ...inferred,
    ...metadata,
    ticker: normalizedTicker,
    name: metadata?.name && metadata.name !== normalizedTicker ? metadata.name : inferred.name,
    sector,
    exchange: metadata?.exchange && metadata.exchange !== "Unknown" ? metadata.exchange : inferred.exchange,
    currency: metadata?.currency ?? inferred.currency,
  };
}

export function calculateHoldings(
  transactions: Transaction[],
  securityMetadata: SecurityMetadata[],
  currentPrices: Record<string, number>,
): Holding[] {
  const positions = new Map<string, PositionAccumulator>();

  const orderedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  for (const transaction of orderedTransactions) {
    const ticker = normalizeTicker(transaction.ticker);
    if (!ticker) continue;

    const existing = positions.get(ticker) ?? {
      ticker,
      quantity: 0,
      costBasis: 0,
      lastTradePrice: 0,
      firstBuyDate: "",
      lastActionDate: transaction.date,
    };

    existing.lastActionDate = transaction.date;

    if (transaction.action === "BUY") {
      existing.lastTradePrice = transaction.price;
      const tradeCost = transaction.quantity * transaction.price + transaction.fees;
      existing.quantity += transaction.quantity;
      existing.costBasis += tradeCost;
      if (!existing.firstBuyDate) existing.firstBuyDate = transaction.date;
    }

    if (transaction.action === "SELL" && existing.quantity > 0) {
      existing.lastTradePrice = transaction.price;
      const sellQuantity = Math.min(transaction.quantity, existing.quantity);
      const avgCost = existing.costBasis / existing.quantity;
      existing.quantity -= sellQuantity;
      existing.costBasis -= avgCost * sellQuantity;
      if (existing.quantity <= 0.000001) {
        existing.quantity = 0;
        existing.costBasis = 0;
      }
    }

    positions.set(ticker, existing);
  }

  const preliminaryHoldings = Array.from(positions.values())
    .filter((position) => position.quantity > 0)
    .map((position) => {
      const metadata = resolveSecurity(position.ticker, securityMetadata);
      const avgCost = position.costBasis / position.quantity;
      const currentPrice =
        currentPrices[position.ticker] ?? (position.lastTradePrice || avgCost);
      const marketValue = position.quantity * currentPrice;
      const unrealizedPnl = marketValue - position.costBasis;

      return {
        ticker: metadata.ticker,
        name: metadata.name,
        sector: metadata.sector,
        currency: metadata.currency,
        exchange: metadata.exchange,
        quantity: round(position.quantity, 6),
        avgCost: round(avgCost),
        costBasis: round(position.costBasis),
        currentPrice: round(currentPrice),
        marketValue: round(marketValue),
        unrealizedPnl: round(unrealizedPnl),
        unrealizedPnlPct: position.costBasis
          ? round((unrealizedPnl / position.costBasis) * 100, 2)
          : 0,
        weightPct: 0,
        firstBuyDate: position.firstBuyDate,
        lastActionDate: position.lastActionDate,
      } satisfies Holding;
    });

  const totalMarketValue = preliminaryHoldings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );

  return preliminaryHoldings
    .map((holding) => ({
      ...holding,
      weightPct: totalMarketValue
        ? round((holding.marketValue / totalMarketValue) * 100, 2)
        : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

export function calculatePortfolioSummary(
  holdings: Holding[],
): PortfolioSummary {
  const portfolioValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );
  const costBasis = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const unrealizedPnl = portfolioValue - costBasis;

  return {
    portfolioValue: round(portfolioValue),
    costBasis: round(costBasis),
    unrealizedPnl: round(unrealizedPnl),
    unrealizedPnlPct: costBasis ? round((unrealizedPnl / costBasis) * 100) : 0,
    realizedPnl: 0,
    estimatedXirr: "Coming soon",
    hhi: calculateHhi(holdings),
  };
}

export function calculateHoldingsFromSnapshot(
  snapshotRows: PortfolioSnapshotRow[],
  securityMetadata: SecurityMetadata[],
): Holding[] {
  const rowsByTicker = new Map<
    string,
    {
      ticker: string;
      name: string;
      sector: string;
      currency: string;
      exchange: string;
      quantity: number;
      costBasis: number;
      marketValue: number;
      unrealizedPnl: number;
      firstBuyDate: string;
      lastActionDate: string;
    }
  >();

  snapshotRows
    .filter((row) => !isSnapshotClosed(row) && row.shares > 0)
    .forEach((row) => {
      const ticker = normalizeTicker(row.ticker);
      const metadata = resolveSecurity(ticker, securityMetadata, row.securityType);
      const costBasis = row.costBasis || row.shares * row.purchasePrice;
      const marketValue = row.valueUsd || row.shares * row.currentPrice;
      const unrealizedPnl =
        row.activeEarning ?? marketValue - costBasis;
      const existing = rowsByTicker.get(ticker);

      if (existing) {
        existing.quantity += row.shares;
        existing.costBasis += costBasis;
        existing.marketValue += marketValue;
        existing.unrealizedPnl += unrealizedPnl;
        if (row.purchaseDate && (!existing.firstBuyDate || row.purchaseDate < existing.firstBuyDate)) {
          existing.firstBuyDate = row.purchaseDate;
        }
        if (row.soldDate && row.soldDate > existing.lastActionDate) {
          existing.lastActionDate = row.soldDate;
        }
        if (row.purchaseDate && row.purchaseDate > existing.lastActionDate) {
          existing.lastActionDate = row.purchaseDate;
        }
        return;
      }

      rowsByTicker.set(ticker, {
        ticker,
        name: metadata.name,
        sector: metadata.sector,
        currency: metadata.currency,
        exchange: metadata.exchange,
        quantity: row.shares,
        costBasis,
        marketValue,
        unrealizedPnl,
        firstBuyDate: row.purchaseDate ?? "",
        lastActionDate: row.soldDate ?? row.purchaseDate ?? "",
      });
    });

  const activeHoldings = Array.from(rowsByTicker.values()).map((row) => ({
    ticker: row.ticker,
    name: row.name,
    sector: row.sector,
    currency: row.currency,
    exchange: row.exchange,
    quantity: round(row.quantity, 6),
    avgCost: row.quantity ? round(row.costBasis / row.quantity) : 0,
    costBasis: round(row.costBasis),
    currentPrice: row.quantity ? round(row.marketValue / row.quantity) : 0,
    marketValue: round(row.marketValue),
    unrealizedPnl: round(row.unrealizedPnl),
    unrealizedPnlPct: row.costBasis
      ? round((row.unrealizedPnl / row.costBasis) * 100)
      : 0,
    weightPct: 0,
    firstBuyDate: row.firstBuyDate,
    lastActionDate: row.lastActionDate,
  }) satisfies Holding);

  const totalMarketValue = activeHoldings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );

  return activeHoldings
    .map((holding) => ({
      ...holding,
      weightPct: totalMarketValue
        ? round((holding.marketValue / totalMarketValue) * 100, 2)
        : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

export function calculateSnapshotRealizedPnl(
  snapshotRows: PortfolioSnapshotRow[],
): number {
  return round(
    snapshotRows
      .filter((row) => row.status === "Closed")
      .reduce((sum, row) => sum + (row.finalEarning ?? 0), 0),
  );
}

export function calculateClosedPositionsFromSnapshot(
  snapshotRows: PortfolioSnapshotRow[],
  securityMetadata: SecurityMetadata[],
): ClosedPosition[] {
  return snapshotRows
    .filter((row) => isSnapshotClosed(row))
    .map((row) => {
      const ticker = normalizeTicker(row.ticker);
      const metadata = resolveSecurity(ticker, securityMetadata, row.securityType);
      const costBasis = row.costBasis || row.shares * row.purchasePrice;
      const proceeds = row.soldPrice
        ? row.shares * row.soldPrice
        : costBasis + (row.finalEarning ?? 0);
      const realizedPnl = row.finalEarning ?? proceeds - costBasis;

      return {
        ticker,
        name: metadata.name,
        sector: metadata.sector,
        securityType: row.securityType,
        quantity: round(row.shares, 6),
        purchaseDate: row.purchaseDate,
        purchasePrice: round(row.purchasePrice),
        costBasis: round(costBasis),
        soldDate: row.soldDate,
        soldPrice: row.soldPrice ? round(row.soldPrice) : undefined,
        proceeds: round(proceeds),
        realizedPnl: round(realizedPnl),
        realizedPnlPct: costBasis ? round((realizedPnl / costBasis) * 100) : 0,
      } satisfies ClosedPosition;
    })
    .sort((a, b) => b.realizedPnl - a.realizedPnl);
}

export function calculateSectorExposure(holdings: Holding[]): SectorExposure[] {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const sectors = new Map<string, Omit<SectorExposure, "weightPct">>();

  for (const holding of holdings) {
    const existing = sectors.get(holding.sector) ?? {
      sector: holding.sector,
      value: 0,
      costBasis: 0,
      unrealizedPnl: 0,
      positions: 0,
    };

    existing.value += holding.marketValue;
    existing.costBasis += holding.costBasis;
    existing.unrealizedPnl += holding.unrealizedPnl;
    existing.positions += 1;
    sectors.set(holding.sector, existing);
  }

  return Array.from(sectors.values())
    .map((sector) => ({
      ...sector,
      value: round(sector.value),
      costBasis: round(sector.costBasis),
      unrealizedPnl: round(sector.unrealizedPnl),
      weightPct: totalValue ? round((sector.value / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateTopWinnersLosers(holdings: Holding[]): {
  winners: WinnerLoser[];
  losers: WinnerLoser[];
} {
  const items = holdings.map((holding) => ({
    ticker: holding.ticker,
    name: holding.name,
    unrealizedPnl: holding.unrealizedPnl,
    unrealizedPnlPct: holding.unrealizedPnlPct,
  }));

  return {
    winners: [...items].sort((a, b) => b.unrealizedPnl - a.unrealizedPnl).slice(0, 5),
    losers: [...items].sort((a, b) => a.unrealizedPnl - b.unrealizedPnl).slice(0, 5),
  };
}

export function calculateHhi(holdings: Holding[]): number {
  return round(
    holdings.reduce((sum, holding) => {
      const share = holding.weightPct / 100;
      return sum + share * share;
    }, 0) * 10000,
    0,
  );
}
