"use client";

// Fully client-side Google Drive integration. The app is served as a static
// site (GitHub Pages), so there is no server to hold secrets or proxy the
// Drive API. Instead we use Google Identity Services (GIS) to obtain an OAuth
// access token in the browser and call the Drive REST API directly.
//
// Data is stored in the user's private "appDataFolder" — a hidden, per-user
// folder dedicated to this application. It does not appear in the user's
// normal Drive, and no other app or site can read it. The narrow
// `drive.appdata` scope is the only access we request.

const GIS_SRC = "https://accounts.google.com/gsi/client";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export const PORTFOLIO_FILE_NAME = "investor-os-portfolio.json";

const TOKEN_SESSION_KEY = "investor-os.gdrive.token";

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
  callback: (response: GisTokenResponse) => void;
}

// Minimal shape of the parts of the global `google` object we touch.
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GisTokenResponse) => void;
          }) => GisTokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

interface StoredToken {
  accessToken: string;
  // Epoch milliseconds at which the token expires.
  expiresAt: number;
}

let gisPromise: Promise<void> | null = null;
let tokenClient: GisTokenClient | null = null;
let tokenClientId: string | null = null;
let currentToken: StoredToken | null = null;

function loadStoredToken(): StoredToken | null {
  if (currentToken && currentToken.expiresAt > Date.now() + 10_000) {
    return currentToken;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TOKEN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (parsed.expiresAt > Date.now() + 10_000) {
      currentToken = parsed;
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function persistToken(token: StoredToken | null) {
  currentToken = token;
  if (typeof window === "undefined") return;
  if (token) {
    window.sessionStorage.setItem(TOKEN_SESSION_KEY, JSON.stringify(token));
  } else {
    window.sessionStorage.removeItem(TOKEN_SESSION_KEY);
  }
}

export function hasValidToken(): boolean {
  return loadStoredToken() !== null;
}

// Inject the GIS client script once and resolve when it is ready.
function loadGis(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Drive sync requires a browser."));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services.")),
      );
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });

  return gisPromise;
}

async function ensureTokenClient(clientId: string): Promise<GisTokenClient> {
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google Identity Services unavailable.");

  if (!tokenClient || tokenClientId !== clientId) {
    tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: () => {},
    });
    tokenClientId = clientId;
  }
  return tokenClient;
}

// Request an access token. `interactive` controls whether Google may show a
// consent/account-chooser popup. A non-interactive (silent) request only
// succeeds if the user has already consented in this browser; it is used for
// auto-pull on load and fails quietly otherwise.
export async function requestToken(
  clientId: string,
  interactive: boolean,
): Promise<string> {
  const cached = loadStoredToken();
  if (cached) return cached.accessToken;

  const client = await ensureTokenClient(clientId);

  return new Promise<string>((resolve, reject) => {
    client.callback = (response: GisTokenResponse) => {
      if (response.error || !response.access_token) {
        reject(
          new Error(
            response.error_description ||
              response.error ||
              "Google sign-in was not completed.",
          ),
        );
        return;
      }
      const token: StoredToken = {
        accessToken: response.access_token,
        expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
      };
      persistToken(token);
      resolve(token.accessToken);
    };
    client.requestAccessToken({ prompt: interactive ? "consent" : "none" });
  });
}

export function disconnect(): void {
  const token = loadStoredToken();
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token.accessToken);
  }
  persistToken(null);
}

async function driveFetch(token: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    // Token rejected — drop it so the next action re-prompts.
    persistToken(null);
    throw new Error("Google session expired. Please connect again.");
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Drive request failed (${response.status}). ${detail}`);
  }
  return response;
}

export interface DriveFile {
  id: string;
  modifiedTime?: string;
}

// Locate the single portfolio file inside the app's private folder.
export async function findPortfolioFile(
  token: string,
): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name='${PORTFOLIO_FILE_NAME}' and trashed=false`,
    fields: "files(id,modifiedTime)",
    pageSize: "1",
  });
  const response = await driveFetch(token, `${DRIVE_FILES_URL}?${params}`);
  const json = (await response.json()) as { files?: DriveFile[] };
  return json.files?.[0] ?? null;
}

export async function downloadPortfolioFile(
  token: string,
  fileId: string,
): Promise<string> {
  const response = await driveFetch(
    token,
    `${DRIVE_FILES_URL}/${fileId}?alt=media`,
  );
  return response.text();
}

// Create or overwrite the portfolio file with the given JSON content.
export async function uploadPortfolioFile(
  token: string,
  fileId: string | null,
  content: string,
): Promise<DriveFile> {
  if (fileId) {
    const response = await driveFetch(
      token,
      `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media&fields=id,modifiedTime`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: content,
      },
    );
    return (await response.json()) as DriveFile;
  }

  // Multipart create so we can set the name and appDataFolder parent in one
  // request alongside the file body.
  const boundary = "investor-os-" + Math.random().toString(36).slice(2);
  const metadata = {
    name: PORTFOLIO_FILE_NAME,
    parents: ["appDataFolder"],
  };
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    `${content}\r\n` +
    `--${boundary}--`;

  const response = await driveFetch(
    token,
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,modifiedTime`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return (await response.json()) as DriveFile;
}
