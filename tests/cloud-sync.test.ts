import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PORTFOLIO_KEYS,
  isEmptyBundle,
  parseBundle,
  readLocalBundle,
  writeLocalBundle,
} from "@/lib/portfolio-bundle";
import {
  downloadPortfolioFile,
  findPortfolioFile,
  requestToken,
  uploadPortfolioFile,
} from "@/lib/google-drive";

// In-memory stand-in for the user's Drive appDataFolder.
interface FakeFile {
  id: string;
  name: string;
  modifiedTime: string;
  content: string;
}

const CLIENT_ID = "test-client.apps.googleusercontent.com";

let drive: Map<string, FakeFile>;
let idCounter: number;

function readMultipart(body: string, contentType: string) {
  const boundary = contentType.split("boundary=")[1];
  const parts: Record<string, unknown>[] = [];
  for (const section of body.split(`--${boundary}`)) {
    const split = section.indexOf("\r\n\r\n");
    if (split === -1) continue;
    const payload = section.slice(split + 4).trim();
    if (!payload.startsWith("{")) continue;
    try {
      parts.push(JSON.parse(payload));
    } catch {
      // not JSON — ignore
    }
  }
  return parts;
}

// Minimal Drive REST emulator covering exactly the calls google-drive.ts makes.
function fakeFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method ?? "GET";
  const ok = (body: unknown) =>
    Promise.resolve(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

  // List files in appDataFolder.
  if (url.includes("/drive/v3/files?") && method === "GET") {
    const files = [...drive.values()].map((f) => ({
      id: f.id,
      modifiedTime: f.modifiedTime,
    }));
    return ok({ files });
  }

  // Download file content.
  const mediaMatch = url.match(/\/drive\/v3\/files\/([^?]+)\?alt=media/);
  if (mediaMatch && method === "GET") {
    const file = drive.get(mediaMatch[1]);
    return ok(file ? file.content : "");
  }

  // Update existing file content.
  const patchMatch = url.match(/\/upload\/drive\/v3\/files\/([^?]+)\?/);
  if (patchMatch && method === "PATCH") {
    const file = drive.get(patchMatch[1])!;
    file.content = init!.body as string;
    file.modifiedTime = new Date().toISOString();
    return ok({ id: file.id, modifiedTime: file.modifiedTime });
  }

  // Create new file (multipart).
  if (url.includes("/upload/drive/v3/files?") && method === "POST") {
    const headers = init!.headers as Record<string, string>;
    const parts = readMultipart(init!.body as string, headers["Content-Type"]);
    const metadata = parts.find((p) => "name" in p) as { name: string };
    const content = parts.find((p) => "data" in p || "version" in p);
    const id = `file-${++idCounter}`;
    const file: FakeFile = {
      id,
      name: metadata.name,
      modifiedTime: new Date().toISOString(),
      content: JSON.stringify(content),
    };
    drive.set(id, file);
    return ok({ id, modifiedTime: file.modifiedTime });
  }

  return Promise.reject(new Error(`Unexpected request: ${method} ${url}`));
}

beforeEach(() => {
  drive = new Map();
  idCounter = 0;
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(fakeFetch));

  // Stand-in for Google Identity Services that hands back a token instantly.
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: (config) => {
          const client = {
            callback: config.callback,
            requestAccessToken: () =>
              client.callback({ access_token: "fake-token", expires_in: 3600 }),
          };
          return client;
        },
        revoke: () => {},
      },
    },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.google;
});

describe("portfolio bundle", () => {
  it("round-trips localStorage through a bundle", () => {
    window.localStorage.setItem(
      PORTFOLIO_KEYS.portfolioSnapshot,
      JSON.stringify([{ ticker: "AAPL", shares: 10, purchasePrice: 100 }]),
    );
    const bundle = readLocalBundle();
    window.localStorage.clear();
    writeLocalBundle(bundle);
    expect(
      JSON.parse(
        window.localStorage.getItem(PORTFOLIO_KEYS.portfolioSnapshot)!,
      ),
    ).toEqual([{ ticker: "AAPL", shares: 10, purchasePrice: 100 }]);
  });

  it("detects empty bundles", () => {
    expect(isEmptyBundle(readLocalBundle())).toBe(true);
    window.localStorage.setItem(
      PORTFOLIO_KEYS.transactions,
      JSON.stringify([{ ticker: "MSFT" }]),
    );
    expect(isEmptyBundle(readLocalBundle())).toBe(false);
  });
});

describe("Google Drive sync end-to-end", () => {
  it("pushes from one device and pulls onto another", async () => {
    // --- Device 1: add local data and push to Drive ---
    const snapshot = [
      { ticker: "AAPL", shares: 10, purchasePrice: 175.5 },
      { ticker: "NVDA", shares: 4, purchasePrice: 800 },
    ];
    window.localStorage.setItem(
      PORTFOLIO_KEYS.portfolioSnapshot,
      JSON.stringify(snapshot),
    );
    window.localStorage.setItem(
      PORTFOLIO_KEYS.decisionJournal,
      JSON.stringify([{ id: "1", note: "bought the dip" }]),
    );

    const token = await requestToken(CLIENT_ID, true);
    expect(token).toBe("fake-token");

    let existing = await findPortfolioFile(token);
    expect(existing).toBeNull(); // nothing in Drive yet

    const bundle = readLocalBundle();
    await uploadPortfolioFile(token, null, JSON.stringify(bundle));
    expect(drive.size).toBe(1);

    // --- Device 2: empty localStorage, connect, pull ---
    window.localStorage.clear();
    expect(window.localStorage.getItem(PORTFOLIO_KEYS.portfolioSnapshot)).toBeNull();

    const token2 = await requestToken(CLIENT_ID, false); // silent/cached
    const file = await findPortfolioFile(token2);
    expect(file).not.toBeNull();

    const text = await downloadPortfolioFile(token2, file!.id);
    const pulled = parseBundle(text);
    writeLocalBundle(pulled);

    // Device 2 now mirrors device 1.
    expect(
      JSON.parse(window.localStorage.getItem(PORTFOLIO_KEYS.portfolioSnapshot)!),
    ).toEqual(snapshot);
    expect(
      JSON.parse(window.localStorage.getItem(PORTFOLIO_KEYS.decisionJournal)!),
    ).toEqual([{ id: "1", note: "bought the dip" }]);
  });

  it("updates the existing file on a second push instead of duplicating", async () => {
    const token = await requestToken(CLIENT_ID, true);

    window.localStorage.setItem(PORTFOLIO_KEYS.transactions, JSON.stringify([1]));
    await uploadPortfolioFile(token, null, JSON.stringify(readLocalBundle()));
    expect(drive.size).toBe(1);

    window.localStorage.setItem(PORTFOLIO_KEYS.transactions, JSON.stringify([1, 2]));
    const file = await findPortfolioFile(token);
    await uploadPortfolioFile(token, file!.id, JSON.stringify(readLocalBundle()));

    expect(drive.size).toBe(1); // overwritten, not duplicated
    const stored = parseBundle([...drive.values()][0].content);
    expect(stored.data[PORTFOLIO_KEYS.transactions]).toEqual([1, 2]);
  });
});
