"use client";

import { loadBundledCloses } from "@/lib/bundled-prices";
import {
  fetchDailyCloses,
  fetchTwelveData,
  getTwelveDataKey,
} from "@/lib/market-data";
import type { PriceHistoryPoint } from "@/lib/types";

// Single entry point for getting prices. Strategy:
//   1. Read the bundled static dataset (no API call) for every ticker.
//   2. For tickers NOT in the dataset, fetch live — Twelve Data when an API key
//      is set, otherwise the keyless proxy path.
// `notBundled` is surfaced so the UI can suggest adding those symbols to the
// dataset, after which no live call is needed for them.

export interface PriceServiceResult {
  prices: PriceHistoryPoint[];
  notBundled: string[]; // tickers that were not in the static dataset
  stillMissing: string[]; // tickers we could not get prices for at all
  usedLive: boolean;
}

export async function getPrices(
  tickers: string[],
  from: string,
): Promise<PriceServiceResult> {
  const bundled = await loadBundledCloses(tickers);
  const prices = [...bundled.prices];
  const notBundled = bundled.missing;

  if (notBundled.length === 0) {
    return { prices, notBundled, stillMissing: [], usedLive: false };
  }

  const apiKey = getTwelveDataKey();
  const live = apiKey
    ? await fetchTwelveData(notBundled, from, apiKey)
    : await fetchDailyCloses(notBundled, from);

  prices.push(...live.prices);
  return {
    prices,
    notBundled,
    stillMissing: live.failed,
    usedLive: true,
  };
}
