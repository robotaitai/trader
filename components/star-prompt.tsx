"use client";

import { Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";

// Non-blocking, one-time invitation to star the repo, shown after a successful
// upload. We can't verify a star on a static site (that needs GitHub OAuth), so
// this nudges rather than gates — honest and bypass-friendly by design.

const REPO_URL = "https://github.com/robotaitai/trader";
const SEEN_KEY = "investor-os.github-star";

export function hasSeenStarPrompt() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SEEN_KEY) === "done";
}

function markSeen() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SEEN_KEY, "done");
  }
}

export function StarPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const dismiss = () => {
    markSeen();
    onClose();
  };

  const star = () => {
    window.open(REPO_URL, "_blank", "noopener,noreferrer");
    dismiss();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Star this project on GitHub"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="float-right text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold">Your portfolio is loaded! 🎉</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This dashboard is free and open-source. If it&apos;s useful, a GitHub
          star helps other investors find it — it&apos;s one click.
        </p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 gap-2" onClick={star}>
            <Star className="h-4 w-4" />
            Star on GitHub
          </Button>
          <Button variant="outline" onClick={dismiss}>
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}
