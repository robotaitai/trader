"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  disconnect as driveDisconnect,
  downloadPortfolioFile,
  findPortfolioFile,
  hasValidToken,
  requestToken,
  uploadPortfolioFile,
} from "@/lib/google-drive";
import {
  isEmptyBundle,
  parseBundle,
  readLocalBundle,
  writeLocalBundle,
} from "@/lib/portfolio-bundle";

// A public OAuth client ID is not a secret, so it can be baked in at build
// time for the canonical deployment. Forks set their own without committing
// it by typing it into the UI (persisted in localStorage).
const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const CLIENT_ID_KEY = "investor-os.gdrive.client-id";
const AUTOPULL_KEY = "investor-os.gdrive.autopull";
const LAST_SYNCED_KEY = "investor-os.gdrive.last-synced";

export type SyncState = "idle" | "working" | "ok" | "error";

export interface DriveSync {
  clientId: string;
  setClientId: (value: string) => void;
  clientIdLocked: boolean; // true when provided via build-time env var
  connected: boolean;
  autoPull: boolean;
  setAutoPull: (value: boolean) => void;
  state: SyncState;
  message: string;
  lastSynced: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  push: () => Promise<void>;
  pull: () => Promise<void>;
}

function readLocal(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export function useDriveSync(): DriveSync {
  const [clientId, setClientIdState] = useState(ENV_CLIENT_ID);
  const [connected, setConnected] = useState(false);
  const [autoPull, setAutoPullState] = useState(false);
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState("");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const autoPullAttempted = useRef(false);

  const clientIdLocked = ENV_CLIENT_ID.length > 0;

  const setClientId = useCallback(
    (value: string) => {
      if (clientIdLocked) return;
      setClientIdState(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CLIENT_ID_KEY, value.trim());
      }
    },
    [clientIdLocked],
  );

  const setAutoPull = useCallback((value: boolean) => {
    setAutoPullState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTOPULL_KEY, value ? "1" : "0");
    }
  }, []);

  const doPull = useCallback(
    async (clientIdValue: string, interactive: boolean) => {
      const token = await requestToken(clientIdValue, interactive);
      const file = await findPortfolioFile(token);
      if (!file) {
        if (interactive) {
          setState("ok");
          setMessage(
            "Connected. No portfolio found in Drive yet — push this device to create it.",
          );
        }
        return;
      }
      const text = await downloadPortfolioFile(token, file.id);
      const bundle = parseBundle(text);
      if (isEmptyBundle(bundle)) {
        setState("ok");
        setMessage("Drive portfolio is empty. Nothing to pull.");
        return;
      }
      writeLocalBundle(bundle);
      const stamp = file.modifiedTime ?? new Date().toISOString();
      window.localStorage.setItem(LAST_SYNCED_KEY, stamp);
      // Reload so every view re-reads localStorage with the pulled data.
      window.location.reload();
    },
    [],
  );

  // Restore persisted preferences and attempt a silent auto-pull on load.
  useEffect(() => {
    if (!clientIdLocked) {
      const stored = readLocal(CLIENT_ID_KEY);
      if (stored) setClientIdState(stored);
    }
    const auto = readLocal(AUTOPULL_KEY) === "1";
    setAutoPullState(auto);
    setLastSynced(readLocal(LAST_SYNCED_KEY) || null);
    setConnected(hasValidToken());

    if (autoPullAttempted.current) return;
    autoPullAttempted.current = true;

    const effectiveClientId = clientIdLocked
      ? ENV_CLIENT_ID
      : readLocal(CLIENT_ID_KEY);
    if (auto && effectiveClientId) {
      // Silent: only proceeds if the user already consented in this browser.
      doPull(effectiveClientId, false)
        .then(() => setConnected(hasValidToken()))
        .catch(() => {
          // Stay quiet; the user can connect manually.
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    if (!clientId) {
      setState("error");
      setMessage("Enter your Google OAuth Client ID first.");
      return;
    }
    setState("working");
    setMessage("Opening Google sign-in...");
    try {
      await requestToken(clientId, true);
      setConnected(true);
      setState("ok");
      setMessage("Connected to Google Drive.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    }
  }, [clientId]);

  const disconnect = useCallback(() => {
    driveDisconnect();
    setConnected(false);
    setState("idle");
    setMessage("Disconnected from Google Drive.");
  }, []);

  const push = useCallback(async () => {
    if (!clientId) {
      setState("error");
      setMessage("Enter your Google OAuth Client ID first.");
      return;
    }
    setState("working");
    setMessage("Pushing this device's portfolio to Drive...");
    try {
      const token = await requestToken(clientId, !hasValidToken());
      setConnected(true);
      const bundle = readLocalBundle();
      const existing = await findPortfolioFile(token);
      const saved = await uploadPortfolioFile(
        token,
        existing?.id ?? null,
        JSON.stringify(bundle),
      );
      const stamp = saved.modifiedTime ?? new Date().toISOString();
      window.localStorage.setItem(LAST_SYNCED_KEY, stamp);
      setLastSynced(stamp);
      setState("ok");
      setMessage("Pushed to Google Drive.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Push failed.");
    }
  }, [clientId]);

  const pull = useCallback(async () => {
    if (!clientId) {
      setState("error");
      setMessage("Enter your Google OAuth Client ID first.");
      return;
    }
    setState("working");
    setMessage("Pulling portfolio from Drive...");
    try {
      await doPull(clientId, !hasValidToken());
      setConnected(true);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Pull failed.");
    }
  }, [clientId, doPull]);

  return {
    clientId,
    setClientId,
    clientIdLocked,
    connected,
    autoPull,
    setAutoPull,
    state,
    message,
    lastSynced,
    connect,
    disconnect,
    push,
    pull,
  };
}
