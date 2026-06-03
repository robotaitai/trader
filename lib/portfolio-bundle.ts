"use client";

import { getLocalUpdatedAt, setLocalUpdatedAt } from "@/lib/storage-events";

// Central list of every localStorage key that holds user portfolio data.
// Keeping them in one place lets the cloud-sync layer serialize the whole
// portfolio into a single portable bundle without each feature re-declaring
// its own key.
export const PORTFOLIO_KEYS = {
  transactions: "investor-os.transactions",
  securityMetadata: "investor-os.security-metadata",
  currentPrices: "investor-os.current-prices",
  portfolioSnapshot: "investor-os.portfolio-snapshot",
  priceHistory: "investor-os.price-history",
  decisionJournal: "investor-os.decision-journal",
} as const;

export const PORTFOLIO_KEY_LIST = Object.values(PORTFOLIO_KEYS);

export const BUNDLE_VERSION = 1 as const;

export interface PortfolioBundle {
  version: typeof BUNDLE_VERSION;
  // ISO timestamp of the moment the bundle was produced.
  updatedAt: string;
  // Map of localStorage key -> parsed JSON value. Only keys that exist
  // locally are included.
  data: Record<string, unknown>;
}

// Read every known portfolio key from localStorage into a single bundle.
export function readLocalBundle(): PortfolioBundle {
  const data: Record<string, unknown> = {};

  if (typeof window !== "undefined") {
    for (const key of PORTFOLIO_KEY_LIST) {
      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;
      try {
        data[key] = JSON.parse(raw);
      } catch {
        // Skip corrupt values rather than aborting the whole export.
      }
    }
  }

  // Prefer the recorded last-edit time so "newer wins" comparisons across
  // devices are meaningful; fall back to now for first-ever export.
  const updatedAt = getLocalUpdatedAt() ?? new Date().toISOString();
  return { version: BUNDLE_VERSION, updatedAt, data };
}

// Returns true when the bundle carries no actual portfolio data. Used to
// avoid clobbering a populated device with an empty cloud file (or vice
// versa) without warning.
export function isEmptyBundle(bundle: PortfolioBundle | null): boolean {
  if (!bundle) return true;
  return Object.values(bundle.data).every((value) => {
    if (value == null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  });
}

// Write a bundle back into localStorage, overwriting the known portfolio
// keys. Keys absent from the bundle are cleared so the device ends up as an
// exact mirror of the bundle.
export function writeLocalBundle(bundle: PortfolioBundle): void {
  if (typeof window === "undefined") return;

  for (const key of PORTFOLIO_KEY_LIST) {
    if (key in bundle.data) {
      window.localStorage.setItem(key, JSON.stringify(bundle.data[key]));
    } else {
      window.localStorage.removeItem(key);
    }
  }
  // Adopt the bundle's modified time so this device matches the source it was
  // restored from (prevents a needless re-sync loop).
  setLocalUpdatedAt(bundle.updatedAt);
}

export function parseBundle(text: string): PortfolioBundle {
  const parsed = JSON.parse(text) as Partial<PortfolioBundle>;
  if (!parsed || typeof parsed !== "object" || typeof parsed.data !== "object") {
    throw new Error("File is not a valid Investor OS portfolio bundle.");
  }
  return {
    version: BUNDLE_VERSION,
    updatedAt:
      typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : new Date().toISOString(),
    data: parsed.data as Record<string, unknown>,
  };
}
