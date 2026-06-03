"use client";

// Sharing helpers. Only the public tool link and an opt-in performance image are
// ever shared — never the user's raw portfolio data.

const TAGLINE =
  "Tracking my portfolio with Investor OS — a free, private, open-source dashboard:";

export function getAppUrl(): string {
  if (typeof window === "undefined") return "https://robotaitai.github.io/trader/";
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${window.location.origin}${base}/`;
}

type ShareLinkResult = "shared" | "copied" | "cancelled";

export async function shareLink(): Promise<ShareLinkResult> {
  const url = getAppUrl();
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "Investor OS", text: TAGLINE, url });
      return "shared";
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return "cancelled";
    }
  }
  await navigator.clipboard.writeText(`${TAGLINE} ${url}`);
  return "copied";
}

type ShareImageResult = "shared" | "downloaded" | "cancelled";

export async function shareImage(
  blob: Blob,
  filename: string,
): Promise<ShareImageResult> {
  const file = new File([blob], filename, { type: "image/png" });
  if (
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: "My portfolio performance",
        text: `${TAGLINE} ${getAppUrl()}`,
      });
      return "shared";
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
