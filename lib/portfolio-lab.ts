import type {
  Holding,
  MonthlyPerformancePoint,
  PortfolioSnapshotRow,
  PortfolioSummary,
  PriceHistoryPoint,
  SectorExposure,
  Transaction,
} from "@/lib/types";
import { normalizeTicker } from "@/lib/security-classification";

export type LocalInsight = {
  title: string;
  detail: string;
  severity: "watch" | "risk" | "opportunity";
};

export type ScenarioRow = {
  ticker: string;
  name: string;
  currentValue: number;
  scenarioValue: number;
  delta: number;
  scenarioPnl: number;
};

export type ExposureTile = {
  ticker: string;
  name: string;
  sector: string;
  weightPct: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};

type PositionState = Record<string, number>;
type PriceState = Record<string, number>;

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const parseDate = (value: string | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const marketValue = (positions: PositionState, prices: PriceState) =>
  Object.entries(positions).reduce(
    (sum, [ticker, quantity]) => sum + quantity * (prices[ticker] ?? 0),
    0,
  );

const transactionAmount = (transaction: Transaction) => {
  const quantity = transaction.quantity || 1;
  return Math.abs(quantity * transaction.price);
};

const formatMonthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
};

export function calculateWeightedReturn(holdings: Holding[]) {
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const totalPnl = holdings.reduce(
    (sum, holding) => sum + holding.unrealizedPnl,
    0,
  );

  return totalCost ? (totalPnl / totalCost) * 100 : 0;
}

export function calculateContributionRows(holdings: Holding[]) {
  return holdings
    .map((holding) => ({
      ticker: holding.ticker,
      name: holding.name,
      sector: holding.sector,
      contribution: holding.unrealizedPnl,
      contributionPct: holding.weightPct * (holding.unrealizedPnlPct / 100),
      weightPct: holding.weightPct,
    }))
    .sort((a, b) => b.contribution - a.contribution);
}

export function calculateScenarioRows(
  holdings: Holding[],
  marketShockPct: number,
  focusedSector: string,
  focusedSectorShockPct: number,
): ScenarioRow[] {
  return holdings.map((holding) => {
    const shock =
      focusedSector !== "All" && holding.sector === focusedSector
        ? focusedSectorShockPct
        : marketShockPct;
    const scenarioValue = holding.marketValue * (1 + shock / 100);
    const delta = scenarioValue - holding.marketValue;

    return {
      ticker: holding.ticker,
      name: holding.name,
      currentValue: holding.marketValue,
      scenarioValue,
      delta,
      scenarioPnl: holding.unrealizedPnl + delta,
    };
  });
}

export function generatePerformanceInsights(
  holdings: Holding[],
  sectorExposure: SectorExposure[],
  summary: PortfolioSummary,
): LocalInsight[] {
  const insights: LocalInsight[] = [];
  const largestHolding = [...holdings].sort(
    (a, b) => b.weightPct - a.weightPct,
  )[0];
  const largestSector = sectorExposure[0];
  const worstHolding = [...holdings].sort(
    (a, b) => a.unrealizedPnlPct - b.unrealizedPnlPct,
  )[0];
  const bestHolding = [...holdings].sort(
    (a, b) => b.unrealizedPnlPct - a.unrealizedPnlPct,
  )[0];

  if (summary.unrealizedPnl > 0) {
    insights.push({
      title: "Profits are broad enough to measure, not just admire",
      detail: `The portfolio is up ${summary.unrealizedPnlPct.toFixed(2)}% on unrealized P&L. Use the contribution table to separate true drivers from small green positions.`,
      severity: "opportunity",
    });
  }

  if (largestHolding && largestHolding.weightPct >= 20) {
    insights.push({
      title: "Single-name concentration needs a rule",
      detail: `${largestHolding.ticker} is ${largestHolding.weightPct.toFixed(2)}% of active value. Define a trim, hold, or add rule before price movement forces the decision.`,
      severity: "risk",
    });
  }

  if (largestSector && largestSector.weightPct >= 40) {
    insights.push({
      title: "Sector result may dominate stock selection",
      detail: `${largestSector.sector} represents ${largestSector.weightPct.toFixed(2)}% of value. Scenario-test the sector before reading returns as pure stock-picking skill.`,
      severity: "watch",
    });
  }

  if (worstHolding && worstHolding.unrealizedPnlPct < -5) {
    insights.push({
      title: "Loser requires a thesis refresh",
      detail: `${worstHolding.ticker} is down ${Math.abs(worstHolding.unrealizedPnlPct).toFixed(2)}%. Decide whether this is a broken thesis, sizing issue, or acceptable volatility.`,
      severity: "risk",
    });
  }

  if (bestHolding && bestHolding.unrealizedPnlPct > 50) {
    insights.push({
      title: "Winner has become a portfolio decision",
      detail: `${bestHolding.ticker} is up ${bestHolding.unrealizedPnlPct.toFixed(2)}%. Re-underwrite the position at today's weight, not at the original purchase price.`,
      severity: "opportunity",
    });
  }

  return insights.slice(0, 4);
}

export function generateExposureInsights(
  holdings: Holding[],
  sectorExposure: SectorExposure[],
  hhi: number,
): LocalInsight[] {
  const insights: LocalInsight[] = [];
  const largestHolding = [...holdings].sort(
    (a, b) => b.weightPct - a.weightPct,
  )[0];
  const largestSector = sectorExposure[0];
  const smallPositions = holdings.filter((holding) => holding.weightPct < 5);

  if (hhi >= 1800) {
    insights.push({
      title: "Portfolio is meaningfully concentrated",
      detail: `HHI is ${hhi.toLocaleString()}. That is not automatically wrong, but it means position sizing deserves explicit rules.`,
      severity: "risk",
    });
  } else {
    insights.push({
      title: "Concentration is currently controlled",
      detail: `HHI is ${hhi.toLocaleString()}. The exposure map is still useful for spotting hidden sector clusters.`,
      severity: "opportunity",
    });
  }

  if (largestHolding) {
    insights.push({
      title: "Largest position sets the first risk boundary",
      detail: `${largestHolding.ticker} is ${largestHolding.weightPct.toFixed(2)}% of active value. A 20% move there changes the portfolio by about ${(largestHolding.weightPct * 0.2).toFixed(2)}%.`,
      severity: largestHolding.weightPct >= 20 ? "risk" : "watch",
    });
  }

  if (largestSector) {
    insights.push({
      title: "Primary sector cluster",
      detail: `${largestSector.sector} is ${largestSector.weightPct.toFixed(2)}% across ${largestSector.positions} position${largestSector.positions === 1 ? "" : "s"}.`,
      severity: largestSector.weightPct >= 40 ? "risk" : "watch",
    });
  }

  if (smallPositions.length >= 3) {
    insights.push({
      title: "Several positions may be too small to matter",
      detail: `${smallPositions.length} positions are below 5% weight. Either assign them a role or consolidate attention.`,
      severity: "watch",
    });
  }

  return insights.slice(0, 4);
}

export function buildExposureTiles(holdings: Holding[]): ExposureTile[] {
  const rowsByTicker = new Map<string, ExposureTile>();
  const totalValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );

  for (const holding of holdings) {
    const existing = rowsByTicker.get(holding.ticker);

    if (existing) {
      existing.marketValue += holding.marketValue;
      existing.costBasis += holding.costBasis;
      existing.unrealizedPnl += holding.unrealizedPnl;
      continue;
    }

    rowsByTicker.set(holding.ticker, {
      ticker: holding.ticker,
      name: holding.name,
      sector: holding.sector,
      weightPct: 0,
      marketValue: holding.marketValue,
      costBasis: holding.costBasis,
      unrealizedPnl: holding.unrealizedPnl,
      unrealizedPnlPct: 0,
    });
  }

  return Array.from(rowsByTicker.values())
    .map((row) => ({
      ...row,
      weightPct: totalValue ? (row.marketValue / totalValue) * 100 : 0,
      unrealizedPnlPct: row.costBasis
        ? (row.unrealizedPnl / row.costBasis) * 100
        : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

export function getExposureRole(
  exposure: Pick<ExposureTile, "sector" | "weightPct" | "unrealizedPnlPct">,
) {
  if (exposure.sector === "Broad Market") {
    return exposure.weightPct >= 10 ? "Core index anchor" : "Market beta anchor";
  }
  if (exposure.sector === "Growth Index") {
    return exposure.weightPct >= 10 ? "Growth index anchor" : "Growth beta sleeve";
  }
  if (exposure.sector === "Diversified Fund") return "Diversifier";
  if (exposure.weightPct >= 15) return "Core concentration";
  if (exposure.unrealizedPnlPct <= -15) return "Thesis review";
  if (exposure.unrealizedPnlPct >= 75) return "Re-underwrite winner";
  if (exposure.weightPct < 3) return "Tracking position";
  if (exposure.weightPct < 7) return "Satellite position";
  return "Active allocation";
}

export function calculateMonthlyPerformance(
  transactions: Transaction[],
  snapshotRows: PortfolioSnapshotRow[],
  currentPrices: Record<string, number>,
  priceHistory: PriceHistoryPoint[] = [],
): MonthlyPerformancePoint[] {
  if (priceHistory.length > 0) {
    return calculateMonthlyPerformanceFromPriceHistory(
      transactions,
      snapshotRows,
      currentPrices,
      priceHistory,
    );
  }

  const syntheticTransactions =
    transactions.length > 0 ? transactions : snapshotRowsToTransactions(snapshotRows);
  const datedTransactions = syntheticTransactions
    .map((transaction) => ({
      ...transaction,
      parsedDate: parseDate(transaction.date),
    }))
    .filter(
      (transaction): transaction is Transaction & { parsedDate: Date } =>
        transaction.parsedDate !== null,
    )
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  if (datedTransactions.length === 0) return [];

  const firstDate = new Date(
    datedTransactions[0].parsedDate.getFullYear(),
    datedTransactions[0].parsedDate.getMonth(),
    1,
  );
  const now = new Date();
  const lastDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const positions: PositionState = {};
  const prices: PriceState = { ...currentPrices };
  const points: MonthlyPerformancePoint[] = [];

  for (
    let cursor = firstDate;
    cursor <= lastDate;
    cursor = addMonths(cursor, 1)
  ) {
    const key = monthKey(cursor);
    const startingValue = marketValue(positions, prices);
    const monthTransactions = datedTransactions.filter(
      (transaction) => monthKey(transaction.parsedDate) === key,
    );
    let netFlow = 0;

    for (const transaction of monthTransactions) {
      const ticker = transaction.ticker.toUpperCase();
      if (transaction.price > 0) {
        prices[ticker] = transaction.price;
      }

      if (transaction.action === "BUY") {
        positions[ticker] = (positions[ticker] ?? 0) + transaction.quantity;
        netFlow += transaction.quantity * transaction.price + transaction.fees;
      }

      if (transaction.action === "SELL") {
        const sellQuantity = Math.min(
          transaction.quantity,
          positions[ticker] ?? transaction.quantity,
        );
        positions[ticker] = Math.max((positions[ticker] ?? 0) - sellQuantity, 0);
        netFlow -= sellQuantity * transaction.price - transaction.fees;
      }

      if (transaction.action === "DEPOSIT") {
        netFlow += transactionAmount(transaction);
      }

      if (transaction.action === "WITHDRAWAL") {
        netFlow -= transactionAmount(transaction);
      }
    }

    if (key === monthKey(lastDate)) {
      for (const [ticker, currentPrice] of Object.entries(currentPrices)) {
        prices[ticker] = currentPrice;
      }
    }

    const endingValue = marketValue(positions, prices);
    const gainLoss = endingValue - startingValue - netFlow;
    const capitalBase = startingValue + Math.max(netFlow, 0);
    const returnPct = capitalBase ? (gainLoss / capitalBase) * 100 : 0;

    if (startingValue !== 0 || endingValue !== 0 || netFlow !== 0) {
      points.push({
        month: key,
        label: formatMonthLabel(key),
        dataSource: "estimated",
        startingValue,
        endingValue,
        netFlow,
        gainLoss,
        returnPct,
      });
    }
  }

  return points;
}

function calculateMonthlyPerformanceFromPriceHistory(
  transactions: Transaction[],
  snapshotRows: PortfolioSnapshotRow[],
  currentPrices: Record<string, number>,
  priceHistory: PriceHistoryPoint[],
): MonthlyPerformancePoint[] {
  const syntheticTransactions =
    transactions.length > 0 ? transactions : snapshotRowsToTransactions(snapshotRows);
  const datedTransactions = syntheticTransactions
    .map((transaction) => ({
      ...transaction,
      ticker: normalizeTicker(transaction.ticker),
      parsedDate: parseDate(transaction.date),
    }))
    .filter(
      (transaction): transaction is Transaction & { parsedDate: Date } =>
        transaction.parsedDate !== null,
    )
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  if (datedTransactions.length === 0) return [];

  const priceRows = [...priceHistory]
    .map((point) => ({
      ...point,
      ticker: normalizeTicker(point.ticker),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const availableDates = Array.from(
    new Set(priceRows.map((point) => point.date)),
  ).sort();

  if (availableDates.length === 0) return [];

    const priceByDate = new Map<string, PriceState>();
  const runningPrices: PriceState = {};

  for (const date of availableDates) {
    for (const row of priceRows.filter((point) => point.date === date)) {
      runningPrices[row.ticker] = row.close;
    }
    priceByDate.set(date, { ...runningPrices });
  }

  const firstDate = new Date(`${availableDates[0]}T00:00:00Z`);
  const lastDate = new Date(`${availableDates[availableDates.length - 1]}T00:00:00Z`);
  const firstMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  const lastMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
  const points: MonthlyPerformancePoint[] = [];

  for (
    let cursor = firstMonth;
    cursor <= lastMonth;
    cursor = addMonths(cursor, 1)
  ) {
    const key = monthKey(cursor);
    const monthDates = availableDates.filter((date) => monthKey(new Date(`${date}T00:00:00Z`)) === key);
    if (!monthDates.length) continue;

    const firstTradingDate = monthDates[0];
    const lastTradingDate = monthDates[monthDates.length - 1];
    const startPositions = buildPositionsAtDate(
      datedTransactions,
      firstTradingDate,
      false,
    );
    const endPositions = buildPositionsAtDate(
      datedTransactions,
      lastTradingDate,
      true,
    );
    const startingValue = marketValue(
      startPositions,
      priceByDate.get(firstTradingDate) ?? {},
    );
    const endingValue = marketValue(
      endPositions,
      priceByDate.get(lastTradingDate) ?? {},
    );
    const netFlow = datedTransactions
      .filter((transaction) => monthKey(transaction.parsedDate) === key)
      .reduce((sum, transaction) => {
        if (transaction.action === "BUY") {
          return sum + transaction.quantity * transaction.price + transaction.fees;
        }
        if (transaction.action === "SELL") {
          return sum - (transaction.quantity * transaction.price - transaction.fees);
        }
        if (transaction.action === "DEPOSIT") {
          return sum + transactionAmount(transaction);
        }
        if (transaction.action === "WITHDRAWAL") {
          return sum - transactionAmount(transaction);
        }
        return sum;
      }, 0);
    const gainLoss = endingValue - startingValue - netFlow;
    const capitalBase = startingValue + Math.max(netFlow, 0);
    const returnPct = capitalBase ? (gainLoss / capitalBase) * 100 : 0;

    if (startingValue !== 0 || endingValue !== 0 || netFlow !== 0) {
      points.push({
        month: key,
        label: formatMonthLabel(key),
        dataSource: "daily-prices",
        startingValue,
        endingValue,
        netFlow,
        gainLoss,
        returnPct,
      });
    }
  }

  return points;
}

function buildPositionsAtDate(
  transactions: Array<Transaction & { parsedDate: Date }>,
  date: string,
  inclusive: boolean,
) {
  const positions: PositionState = {};
  const cutoff = new Date(`${date}T23:59:59Z`).getTime();

  for (const transaction of transactions) {
    const transactionTime = transaction.parsedDate.getTime();
    if (inclusive ? transactionTime > cutoff : transactionTime >= cutoff) {
      continue;
    }

    const ticker = normalizeTicker(transaction.ticker);
    if (transaction.action === "BUY") {
      positions[ticker] = (positions[ticker] ?? 0) + transaction.quantity;
    }
    if (transaction.action === "SELL") {
      positions[ticker] = Math.max(
        (positions[ticker] ?? 0) - transaction.quantity,
        0,
      );
    }
  }

  return positions;
}

function snapshotRowsToTransactions(
  snapshotRows: PortfolioSnapshotRow[],
): Transaction[] {
  return snapshotRows.flatMap((row, index) => {
    const ticker = normalizeTicker(row.ticker);
    const rows: Transaction[] = [];

    if (row.purchaseDate) {
      rows.push({
        id: `snapshot-buy-${row.id}-${index}`,
        date: row.purchaseDate,
        ticker,
        action: "BUY",
        quantity: row.shares,
        price: row.purchasePrice,
        currency: "USD",
        fees: 0,
        notes: "Synthetic purchase from saved portfolio snapshot",
      });
    }

    if (row.status === "Closed" && row.soldDate && row.soldPrice) {
      rows.push({
        id: `snapshot-sell-${row.id}-${index}`,
        date: row.soldDate,
        ticker,
        action: "SELL",
        quantity: row.shares,
        price: row.soldPrice,
        currency: "USD",
        fees: 0,
        notes: "Synthetic sale from saved portfolio snapshot",
      });
    }

    return rows;
  });
}
