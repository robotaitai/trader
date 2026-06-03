"use client";

import { Fragment, type ReactNode } from "react";

// Minimal, safe markdown renderer (headings, bullets, bold) for AI output.
// Builds React nodes directly — no raw HTML injection, no dependency.

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-1">
        {bullets.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);

    if (bullet) {
      bullets.push(bullet[1]);
    } else if (numbered) {
      bullets.push(numbered[1]);
    } else if (heading) {
      flushBullets();
      blocks.push(
        <p key={`h-${blocks.length}`} className="font-semibold text-foreground">
          {renderInline(heading[2])}
        </p>,
      );
    } else if (line.trim() === "") {
      flushBullets();
    } else {
      flushBullets();
      const italic = line.match(/^\*([^*]+)\*$/);
      blocks.push(
        <p key={`p-${blocks.length}`} className={italic ? "text-xs italic text-muted-foreground" : undefined}>
          {italic ? italic[1] : renderInline(line)}
        </p>,
      );
    }
  }
  flushBullets();

  return <div className="space-y-2 text-sm leading-6">{blocks}</div>;
}
