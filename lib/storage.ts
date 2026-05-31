"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateHoldingsFromSnapshot,
  calculateClosedPositionsFromSnapshot,
  calculateHoldings,
  calculatePortfolioSummary,
  calculateSectorExposure,
  calculateSnapshotRealizedPnl,
  calculateTopWinnersLosers,
} from "@/lib/analytics";
import {
  mockCurrentPrices,
  mockSecurityMetadata,
  mockTransactions,
} from "@/lib/mock-data";
import type {
  PortfolioSnapshotRow,
  PriceHistoryPoint,
  SecurityMetadata,
  Transaction,
} from "@/lib/types";

const TRANSACTIONS_KEY = "investor-os.transactions";
const METADATA_KEY = "investor-os.security-metadata";
const PRICES_KEY = "investor-os.current-prices";
const SNAPSHOT_KEY = "investor-os.portfolio-snapshot";
const PRICE_HISTORY_KEY = "investor-os.price-history";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function usePortfolioData() {
  const [transactions, setTransactionsState] = useState<Transaction[]>([]);
  const [securityMetadata, setSecurityMetadata] =
    useState<SecurityMetadata[]>(mockSecurityMetadata);
  const [currentPrices, setCurrentPrices] =
    useState<Record<string, number>>(mockCurrentPrices);
  const [portfolioSnapshot, setPortfolioSnapshotState] = useState<
    PortfolioSnapshotRow[]
  >([]);
  const [priceHistory, setPriceHistoryState] = useState<PriceHistoryPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTransactionsState(readJson(TRANSACTIONS_KEY, []));
    setSecurityMetadata(readJson(METADATA_KEY, mockSecurityMetadata));
    setCurrentPrices(readJson(PRICES_KEY, mockCurrentPrices));
    setPortfolioSnapshotState(readJson(SNAPSHOT_KEY, []));
    setPriceHistoryState(readJson(PRICE_HISTORY_KEY, []));
    setLoaded(true);
  }, []);

  const setTransactions = useCallback((nextTransactions: Transaction[]) => {
    setTransactionsState(nextTransactions);
    writeJson(TRANSACTIONS_KEY, nextTransactions);
  }, []);

  const setPortfolioSnapshot = useCallback((nextSnapshot: PortfolioSnapshotRow[]) => {
    setPortfolioSnapshotState(nextSnapshot);
    writeJson(SNAPSHOT_KEY, nextSnapshot);
  }, []);

  const setPriceHistory = useCallback((nextPriceHistory: PriceHistoryPoint[]) => {
    setPriceHistoryState(nextPriceHistory);
    writeJson(PRICE_HISTORY_KEY, nextPriceHistory);
  }, []);

  const loadDemoData = useCallback(() => {
    setTransactionsState(mockTransactions);
    setSecurityMetadata(mockSecurityMetadata);
    setCurrentPrices(mockCurrentPrices);
    setPortfolioSnapshotState([]);
    setPriceHistoryState([]);
    writeJson(TRANSACTIONS_KEY, mockTransactions);
    writeJson(METADATA_KEY, mockSecurityMetadata);
    writeJson(PRICES_KEY, mockCurrentPrices);
    writeJson(SNAPSHOT_KEY, []);
    writeJson(PRICE_HISTORY_KEY, []);
  }, []);

  const clearLocalData = useCallback(() => {
    setTransactionsState([]);
    setPortfolioSnapshotState([]);
    setPriceHistoryState([]);
    writeJson(TRANSACTIONS_KEY, []);
    writeJson(SNAPSHOT_KEY, []);
    writeJson(PRICE_HISTORY_KEY, []);
  }, []);

  const holdings = useMemo(
    () =>
      portfolioSnapshot.length > 0
        ? calculateHoldingsFromSnapshot(portfolioSnapshot, securityMetadata)
        : calculateHoldings(transactions, securityMetadata, currentPrices),
    [transactions, securityMetadata, currentPrices, portfolioSnapshot],
  );
  const summary = useMemo(() => {
    const baseSummary = calculatePortfolioSummary(holdings);
    if (portfolioSnapshot.length === 0) return baseSummary;

    return {
      ...baseSummary,
      realizedPnl: calculateSnapshotRealizedPnl(portfolioSnapshot),
    };
  }, [holdings, portfolioSnapshot]);
  const sectorExposure = useMemo(
    () => calculateSectorExposure(holdings),
    [holdings],
  );
  const topWinnersLosers = useMemo(
    () => calculateTopWinnersLosers(holdings),
    [holdings],
  );
  const closedPositions = useMemo(
    () => calculateClosedPositionsFromSnapshot(portfolioSnapshot, securityMetadata),
    [portfolioSnapshot, securityMetadata],
  );
  const dataSource =
    portfolioSnapshot.length > 0
      ? "snapshot"
      : transactions.length > 0
        ? "transactions"
        : "empty";

  return {
    loaded,
    dataSource,
    transactions,
    portfolioSnapshot,
    priceHistory,
    securityMetadata,
    currentPrices,
    holdings,
    closedPositions,
    summary,
    sectorExposure,
    topWinnersLosers,
    setTransactions,
    setPortfolioSnapshot,
    setPriceHistory,
    loadDemoData,
    clearLocalData,
  };
}
