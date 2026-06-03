"use client";

// Lightweight in-tab signal so the file-sync layer can auto-save whenever the
// user edits portfolio data. Same-document localStorage writes do NOT fire the
// native `storage` event, so we dispatch our own custom event instead.

const CHANGE_EVENT = "investor-os:data-changed";
const UPDATED_AT_KEY = "investor-os.updated-at";

// Call after any change to portfolio data. Stamps a last-modified time and
// notifies listeners (debounced auto-save).
export function notifyPortfolioChanged() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function onPortfolioChanged(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

export function getLocalUpdatedAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(UPDATED_AT_KEY);
}

export function setLocalUpdatedAt(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UPDATED_AT_KEY, value);
}
