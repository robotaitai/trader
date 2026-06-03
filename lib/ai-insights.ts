"use client";

// Client-side AI insights. The app is a static site with no backend, so calls
// go straight from the browser to the user's chosen provider using a key stored
// only in localStorage. Enabling this sends a portfolio SUMMARY to that
// provider — by default percentages only, never dollar amounts (see
// includeDollars). Nothing is sent anywhere unless the user clicks Generate.

export type AiProvider = "openai" | "anthropic" | "gemini";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  includeDollars: boolean;
}

const STORAGE_KEY = "investor-os.ai";

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  gemini: "Google Gemini",
};

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-1.5-flash",
};

export const PROVIDER_KEY_HINTS: Record<AiProvider, string> = {
  openai: "platform.openai.com/api-keys",
  anthropic: "console.anthropic.com",
  gemini: "aistudio.google.com/apikey",
};

export function getAiConfig(): AiConfig {
  const fallback: AiConfig = {
    provider: "openai",
    apiKey: "",
    model: DEFAULT_MODELS.openai,
    includeDollars: false,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    const provider = (parsed.provider ?? "openai") as AiProvider;
    return {
      provider,
      apiKey: parsed.apiKey ?? "",
      model: parsed.model || DEFAULT_MODELS[provider],
      includeDollars: Boolean(parsed.includeDollars),
    };
  } catch {
    return fallback;
  }
}

export function setAiConfig(config: AiConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function hasAiKey(): boolean {
  return getAiConfig().apiKey.trim().length > 0;
}

// --- Insight lenses -------------------------------------------------------

export interface InsightLens {
  id: string;
  label: string;
  instruction: string;
}

export const INSIGHT_LENSES: InsightLens[] = [
  {
    id: "review",
    label: "Overall review",
    instruction:
      "Give a concise overall review: what looks healthy, what's concerning, and 2-3 concrete things to consider next.",
  },
  {
    id: "risk",
    label: "Risk & concentration",
    instruction:
      "Analyze diversification and concentration risk using the HHI and sector weights. Flag single-name concentration, heavy sectors, and likely correlated exposures.",
  },
  {
    id: "rebalance",
    label: "Rebalancing ideas",
    instruction:
      "Suggest rebalancing ideas from the weights. Identify the most over- and under-weight positions and sectors, and what a more balanced shape could look like.",
  },
  {
    id: "research",
    label: "What to research",
    instruction:
      "For the largest and the worst-performing positions, list specific, concrete questions or catalysts the investor should research next.",
  },
];

const SYSTEM_PROMPT =
  "You are a sharp, markets-savvy portfolio analyst. Analyze ONLY the data provided; never invent positions, prices, or news. Be concise and specific, citing tickers and the given numbers. Format the answer as short markdown sections with bullet points. Finish with a single italic line noting this is educational information, not financial advice.";

// --- Portfolio context ----------------------------------------------------

export interface InsightHolding {
  ticker: string;
  sector: string;
  weightPct: number;
  returnPct: number;
  value: number;
}

export interface InsightData {
  totalValue: number;
  totalReturnPct: number;
  benchmarkReturnPct: number | null;
  hhi: number;
  holdings: InsightHolding[];
  sectors: { sector: string; weightPct: number }[];
}

export function buildPortfolioContext(
  data: InsightData,
  includeDollars: boolean,
): string {
  const lines: string[] = [];
  lines.push("PORTFOLIO SUMMARY");
  if (includeDollars) {
    lines.push(`Total value: $${Math.round(data.totalValue).toLocaleString()}`);
  }
  lines.push(`Total return (since purchase): ${data.totalReturnPct.toFixed(1)}%`);
  if (data.benchmarkReturnPct != null) {
    lines.push(
      `S&P 500 return over the recent charted range (reference only): ${data.benchmarkReturnPct.toFixed(1)}%`,
    );
  }
  lines.push(
    `Concentration HHI: ${Math.round(data.hhi)} (under 1500 is usually diversified, over 2500 is concentrated)`,
  );

  lines.push("");
  lines.push("HOLDINGS (ticker, weight%, return%, sector):");
  for (const h of [...data.holdings].sort((a, b) => b.weightPct - a.weightPct)) {
    const dollars = includeDollars
      ? `, $${Math.round(h.value).toLocaleString()}`
      : "";
    lines.push(
      `- ${h.ticker}: ${h.weightPct.toFixed(1)}%, ${h.returnPct >= 0 ? "+" : ""}${h.returnPct.toFixed(1)}%, ${h.sector}${dollars}`,
    );
  }

  lines.push("");
  lines.push("SECTOR WEIGHTS:");
  for (const s of data.sectors) {
    lines.push(`- ${s.sector}: ${s.weightPct.toFixed(1)}%`);
  }
  return lines.join("\n");
}

// --- Provider calls -------------------------------------------------------

async function callOpenAi(
  config: AiConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI error ${res.status}`);
  return data.choices?.[0]?.message?.content?.trim() || "No response.";
}

async function callAnthropic(
  config: AiConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic error ${res.status}`);
  return data.content?.[0]?.text?.trim() || "No response.";
}

async function callGemini(
  config: AiConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      config.model,
    )}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4 },
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini error ${res.status}`);
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response."
  );
}

export async function generateInsight(
  config: AiConfig,
  lens: InsightLens,
  context: string,
): Promise<string> {
  const user = `${context}\n\nTASK: ${lens.instruction}`;
  if (config.provider === "anthropic")
    return callAnthropic(config, SYSTEM_PROMPT, user);
  if (config.provider === "gemini")
    return callGemini(config, SYSTEM_PROMPT, user);
  return callOpenAi(config, SYSTEM_PROMPT, user);
}
