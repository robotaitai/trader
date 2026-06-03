"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isEmptyBundle,
  parseBundle,
  readLocalBundle,
  writeLocalBundle,
} from "@/lib/portfolio-bundle";
import { getLocalUpdatedAt, onPortfolioChanged } from "@/lib/storage-events";

// Two file-based ways to move your portfolio between devices, neither of
// which talks to any cloud API:
//
//  1. Export / Import: download the portfolio as a JSON file, carry it
//     anywhere (any cloud drive, AirDrop, email), import it on the other end.
//  2. Link a file (File System Access API): pick a file once — ideally inside
//     a folder your OS already syncs (Google Drive, iCloud, Dropbox) — and the
//     app auto-saves to it. Your existing sync client moves it everywhere.
//
// localStorage stays the live working copy; the file is the portable copy.

export const PORTFOLIO_FILE_NAME = "investor-os-portfolio.json";

// File System Access API is desktop-Chromium only; Export/Import works
// everywhere.
export const fileLinkSupported =
  typeof window !== "undefined" && "showSaveFilePicker" in window;

// ---------------------------------------------------------------------------
// Minimal IndexedDB store for the persistent file handle. Handles survive
// reloads but not a hard browser restart without re-granting permission.
// ---------------------------------------------------------------------------
const DB_NAME = "investor-os";
const STORE = "handles";
const HANDLE_KEY = "portfolio-file";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readHandleFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

async function writeHandleFile(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

type Permission = "granted" | "denied" | "prompt";

async function queryPermission(
  handle: FileSystemFileHandle,
): Promise<Permission> {
  return handle.queryPermission({ mode: "readwrite" });
}

async function requestPermission(
  handle: FileSystemFileHandle,
): Promise<Permission> {
  return handle.requestPermission({ mode: "readwrite" });
}

// ---------------------------------------------------------------------------

export type SyncState = "idle" | "working" | "ok" | "error";

export interface FileSync {
  linkSupported: boolean;
  linked: boolean;
  fileName: string | null;
  needsPermission: boolean;
  autoSave: boolean;
  setAutoSave: (value: boolean) => void;
  state: SyncState;
  message: string;
  // Export / Import (universal)
  exportDownload: () => void;
  importFromFile: (file: File) => Promise<void>;
  // Link a file (File System Access)
  linkExistingFile: () => Promise<void>;
  linkNewFile: () => Promise<void>;
  reconnect: () => Promise<void>;
  saveToFile: () => Promise<void>;
  loadFromFile: () => Promise<void>;
  unlink: () => void;
}

const AUTOSAVE_KEY = "investor-os.file.autosave";

export function useFileSync(): FileSync {
  const [linked, setLinked] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [autoSave, setAutoSaveState] = useState(false);
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState("");

  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  const setAutoSave = useCallback((value: boolean) => {
    setAutoSaveState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTOSAVE_KEY, value ? "1" : "0");
    }
  }, []);

  const writeBundleToHandle = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    await writeHandleFile(handle, JSON.stringify(readLocalBundle()));
  }, []);

  // Pull the file's contents into localStorage and reload so every view picks
  // it up. Only acts when the file is non-empty.
  const applyBundleFromHandle = useCallback(async (): Promise<boolean> => {
    const handle = handleRef.current;
    if (!handle) return false;
    const text = await readHandleFile(handle);
    if (!text.trim()) return false;
    const bundle = parseBundle(text);
    if (isEmptyBundle(bundle)) return false;
    writeLocalBundle(bundle);
    return true;
  }, []);

  const saveToFile = useCallback(async () => {
    if (!handleRef.current) return;
    setState("working");
    setMessage("Saving to linked file...");
    try {
      await writeBundleToHandle();
      setState("ok");
      setMessage(`Saved to ${handleRef.current.name}.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Save failed.");
    }
  }, [writeBundleToHandle]);

  const loadFromFile = useCallback(async () => {
    if (!handleRef.current) return;
    setState("working");
    setMessage("Loading from linked file...");
    try {
      const applied = await applyBundleFromHandle();
      if (applied) {
        window.location.reload();
      } else {
        setState("ok");
        setMessage("Linked file is empty — nothing to load.");
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Load failed.");
    }
  }, [applyBundleFromHandle]);

  const adoptHandle = useCallback(
    async (handle: FileSystemFileHandle, mode: "load" | "create") => {
      handleRef.current = handle;
      await idbSet(HANDLE_KEY, handle);
      setLinked(true);
      setFileName(handle.name);
      setNeedsPermission(false);

      if (mode === "create") {
        await writeBundleToHandle();
        setState("ok");
        setMessage(`Linked ${handle.name}. This device now auto-saves to it.`);
        return;
      }

      // Linking an existing file: load its contents if it has any.
      const applied = await applyBundleFromHandle();
      if (applied) {
        window.location.reload();
      } else {
        // Empty file selected — seed it with whatever is on this device.
        await writeBundleToHandle();
        setState("ok");
        setMessage(`Linked ${handle.name}.`);
      }
    },
    [applyBundleFromHandle, writeBundleToHandle],
  );

  const linkNewFile = useCallback(async () => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: PORTFOLIO_FILE_NAME,
        types: [
          {
            description: "Investor OS portfolio",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      await adoptHandle(handle, "create");
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not link file.");
    }
  }, [adoptHandle]);

  const linkExistingFile = useCallback(async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Investor OS portfolio",
            accept: { "application/json": [".json"] },
          },
        ],
        multiple: false,
      });
      await adoptHandle(handle, "load");
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not link file.");
    }
  }, [adoptHandle]);

  // Re-grant permission for a restored handle (needs a user gesture), then
  // load whatever is in the file.
  const reconnect = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    const permission = await requestPermission(handle);
    if (permission !== "granted") {
      setState("error");
      setMessage("Permission denied for the linked file.");
      return;
    }
    setNeedsPermission(false);
    await loadFromFile();
  }, [loadFromFile]);

  const unlink = useCallback(() => {
    handleRef.current = null;
    setLinked(false);
    setFileName(null);
    setNeedsPermission(false);
    void idbDelete(HANDLE_KEY);
    setState("idle");
    setMessage("Unlinked the file. Data stays on this device.");
  }, []);

  const exportDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(readLocalBundle(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = PORTFOLIO_FILE_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
    setState("ok");
    setMessage(`Downloaded ${PORTFOLIO_FILE_NAME}.`);
  }, []);

  const importFromFile = useCallback(async (file: File) => {
    setState("working");
    setMessage("Importing...");
    try {
      const text = await file.text();
      const bundle = parseBundle(text);
      writeLocalBundle(bundle);
      window.location.reload();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Import failed.");
    }
  }, []);

  // Restore a previously linked handle on mount, and (if permitted) pull in a
  // newer file automatically.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setAutoSaveState(
      typeof window !== "undefined" &&
        window.localStorage.getItem(AUTOSAVE_KEY) === "1",
    );

    if (!fileLinkSupported) return;

    (async () => {
      const handle = await idbGet<FileSystemFileHandle>(HANDLE_KEY).catch(
        () => undefined,
      );
      if (!handle) return;
      handleRef.current = handle;
      setLinked(true);
      setFileName(handle.name);

      const permission = await queryPermission(handle);
      if (permission !== "granted") {
        setNeedsPermission(true);
        return;
      }

      // Auto-load only if the file is strictly newer than this device.
      try {
        const text = await readHandleFile(handle);
        if (!text.trim()) return;
        const bundle = parseBundle(text);
        if (isEmptyBundle(bundle)) return;
        const localUpdated = getLocalUpdatedAt();
        if (!localUpdated || bundle.updatedAt > localUpdated) {
          writeLocalBundle(bundle);
          window.location.reload();
        }
      } catch {
        // Leave the device as-is if the file can't be read silently.
      }
    })();
  }, []);

  // Debounced auto-save whenever portfolio data changes in this tab.
  useEffect(() => {
    if (!autoSave) return;
    return onPortfolioChanged(() => {
      if (!handleRef.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        writeBundleToHandle()
          .then(() => {
            setState("ok");
            setMessage(`Auto-saved to ${handleRef.current?.name ?? "file"}.`);
          })
          .catch((error: unknown) => {
            setState("error");
            setMessage(
              error instanceof Error ? error.message : "Auto-save failed.",
            );
          });
      }, 800);
    });
  }, [autoSave, writeBundleToHandle]);

  return {
    linkSupported: fileLinkSupported,
    linked,
    fileName,
    needsPermission,
    autoSave,
    setAutoSave,
    state,
    message,
    exportDownload,
    importFromFile,
    linkExistingFile,
    linkNewFile,
    reconnect,
    saveToFile,
    loadFromFile,
    unlink,
  };
}
