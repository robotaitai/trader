import { beforeEach, describe, expect, it } from "vitest";
import {
  PORTFOLIO_KEYS,
  isEmptyBundle,
  parseBundle,
  readLocalBundle,
  writeLocalBundle,
} from "@/lib/portfolio-bundle";
import { getLocalUpdatedAt, setLocalUpdatedAt } from "@/lib/storage-events";

const SNAPSHOT = [
  { ticker: "AAPL", shares: 10, purchasePrice: 175.5 },
  { ticker: "NVDA", shares: 4, purchasePrice: 800 },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe("portfolio bundle", () => {
  it("round-trips localStorage through a bundle", () => {
    window.localStorage.setItem(
      PORTFOLIO_KEYS.portfolioSnapshot,
      JSON.stringify(SNAPSHOT),
    );
    window.localStorage.setItem(
      PORTFOLIO_KEYS.decisionJournal,
      JSON.stringify([{ id: "1", note: "bought the dip" }]),
    );

    const bundle = readLocalBundle();
    window.localStorage.clear();
    writeLocalBundle(bundle);

    expect(
      JSON.parse(window.localStorage.getItem(PORTFOLIO_KEYS.portfolioSnapshot)!),
    ).toEqual(SNAPSHOT);
    expect(
      JSON.parse(window.localStorage.getItem(PORTFOLIO_KEYS.decisionJournal)!),
    ).toEqual([{ id: "1", note: "bought the dip" }]);
  });

  it("simulates export on one device and import on another", () => {
    window.localStorage.setItem(
      PORTFOLIO_KEYS.portfolioSnapshot,
      JSON.stringify(SNAPSHOT),
    );

    // Device 1 exports (what the Download button serializes).
    const exported = JSON.stringify(readLocalBundle());

    // Device 2: empty, then imports the file.
    window.localStorage.clear();
    const imported = parseBundle(exported);
    writeLocalBundle(imported);

    expect(
      JSON.parse(window.localStorage.getItem(PORTFOLIO_KEYS.portfolioSnapshot)!),
    ).toEqual(SNAPSHOT);
  });

  it("carries a meaningful last-modified time for newer-wins comparisons", () => {
    setLocalUpdatedAt("2026-01-01T00:00:00.000Z");
    expect(readLocalBundle().updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("adopts the bundle's timestamp when written to a device", () => {
    const bundle = {
      version: 1 as const,
      updatedAt: "2026-05-31T12:00:00.000Z",
      data: { [PORTFOLIO_KEYS.transactions]: [1, 2, 3] },
    };
    writeLocalBundle(bundle);
    expect(getLocalUpdatedAt()).toBe("2026-05-31T12:00:00.000Z");
  });

  it("clears keys absent from the bundle so the device mirrors it", () => {
    window.localStorage.setItem(PORTFOLIO_KEYS.transactions, JSON.stringify([1]));
    writeLocalBundle({
      version: 1,
      updatedAt: new Date().toISOString(),
      data: { [PORTFOLIO_KEYS.portfolioSnapshot]: SNAPSHOT },
    });
    expect(window.localStorage.getItem(PORTFOLIO_KEYS.transactions)).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem(PORTFOLIO_KEYS.portfolioSnapshot)!),
    ).toEqual(SNAPSHOT);
  });

  it("detects empty bundles", () => {
    expect(isEmptyBundle(readLocalBundle())).toBe(true);
    window.localStorage.setItem(
      PORTFOLIO_KEYS.transactions,
      JSON.stringify([{ ticker: "MSFT" }]),
    );
    expect(isEmptyBundle(readLocalBundle())).toBe(false);
  });

  it("rejects files that are not a portfolio bundle", () => {
    expect(() => parseBundle('{"nope": true}')).toThrow();
    expect(() => parseBundle("not json")).toThrow();
  });
});
