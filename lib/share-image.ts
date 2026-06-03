"use client";

// Renders a social-ready performance card (1200x630) on a canvas. By design it
// shows only PERCENTAGES (return + vs S&P 500) and a normalized line — never
// dollar amounts — so sharing it never leaks the user's net worth.

export interface ShareImageInput {
  returnPct: number | null;
  benchmarkPct: number | null;
  rangeLabel: string;
  portfolioValues: number[];
  benchmarkValues: number[];
  appUrl: string;
}

const W = 1200;
const H = 630;
const PAD = 64;
const POS = "#34d399";
const NEG = "#f87171";
const MUTED = "#94a3b8";

const FONT = (size: number, weight = "400") =>
  `${weight} ${size}px Inter, ui-sans-serif, system-ui, Arial, sans-serif`;

function toPctSeries(values: number[]): number[] {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  if (clean.length < 2) return [];
  const base = clean[0];
  return clean.map((value) => (value / base - 1) * 100);
}

function fmtPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function drawSeries(
  ctx: CanvasRenderingContext2D,
  series: number[],
  area: { x: number; y: number; w: number; h: number },
  min: number,
  max: number,
  color: string,
  opts: { fill?: boolean; dashed?: boolean } = {},
) {
  if (series.length < 2) return;
  const span = max - min || 1;
  const xAt = (i: number) => area.x + (i / (series.length - 1)) * area.w;
  const yAt = (v: number) => area.y + area.h - ((v - min) / span) * area.h;

  ctx.save();
  if (opts.dashed) ctx.setLineDash([8, 8]);
  ctx.lineWidth = opts.dashed ? 3 : 5;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.beginPath();
  series.forEach((value, i) => {
    const x = xAt(i);
    const y = yAt(value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  if (opts.fill) {
    ctx.lineTo(xAt(series.length - 1), area.y + area.h);
    ctx.lineTo(xAt(0), area.y + area.h);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
    gradient.addColorStop(0, `${color}33`);
    gradient.addColorStop(1, `${color}05`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
  ctx.restore();
}

export async function renderShareImage(input: ShareImageInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#131a2b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const returnPositive = (input.returnPct ?? 0) >= 0;
  const accent = returnPositive ? POS : NEG;

  // Eyebrow + range
  ctx.fillStyle = MUTED;
  ctx.font = FONT(24, "600");
  ctx.fillText("MY PORTFOLIO RETURN", PAD, PAD + 24);
  ctx.textAlign = "right";
  ctx.fillText(input.rangeLabel.toUpperCase(), W - PAD, PAD + 24);
  ctx.textAlign = "left";

  // Big return number
  ctx.fillStyle = accent;
  ctx.font = FONT(112, "800");
  ctx.fillText(fmtPct(input.returnPct), PAD, PAD + 150);

  // vs S&P 500
  if (input.benchmarkPct != null) {
    const diff = (input.returnPct ?? 0) - input.benchmarkPct;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = FONT(34, "600");
    const beat = diff >= 0;
    ctx.fillText(
      `vs S&P 500  ${fmtPct(input.benchmarkPct)}`,
      PAD,
      PAD + 210,
    );
    ctx.fillStyle = beat ? POS : NEG;
    ctx.font = FONT(28, "700");
    ctx.fillText(
      `${beat ? "▲" : "▼"} ${beat ? "beating" : "trailing"} by ${Math.abs(
        diff,
      ).toFixed(1)}%`,
      PAD,
      PAD + 252,
    );
  }

  // Chart
  const port = toPctSeries(input.portfolioValues);
  const bench = toPctSeries(input.benchmarkValues);
  if (port.length >= 2) {
    const area = { x: PAD, y: 360, w: W - PAD * 2, h: H - 360 - 120 };
    const all = [...port, ...bench, 0];
    const min = Math.min(...all);
    const max = Math.max(...all);

    // zero baseline
    const span = max - min || 1;
    const zeroY = area.y + area.h - ((0 - min) / span) * area.h;
    ctx.save();
    ctx.strokeStyle = "#33415588";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(area.x, zeroY);
    ctx.lineTo(area.x + area.w, zeroY);
    ctx.stroke();
    ctx.restore();

    if (bench.length >= 2)
      drawSeries(ctx, bench, area, min, max, MUTED, { dashed: true });
    drawSeries(ctx, port, area, min, max, accent, { fill: true });
  }

  // Footer
  ctx.fillStyle = "#f8fafc";
  ctx.font = FONT(30, "700");
  ctx.fillText("★ Investor OS", PAD, H - 44);
  ctx.fillStyle = MUTED;
  ctx.font = FONT(24, "500");
  ctx.textAlign = "right";
  ctx.fillText(
    `Track yours free · ${input.appUrl.replace(/^https?:\/\//, "")}`,
    W - PAD,
    H - 44,
  );
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}
