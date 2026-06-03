"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { SimpleMarkdown } from "@/components/simple-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildPortfolioContext,
  generateInsight,
  getAiConfig,
  hasAiKey,
  INSIGHT_LENSES,
  PROVIDER_LABELS,
  type AiConfig,
  type InsightData,
  type InsightLens,
} from "@/lib/ai-insights";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function AiInsightsCard({ data }: { data: InsightData }) {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [lens, setLens] = useState<InsightLens>(INSIGHT_LENSES[0]);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Read config on mount (and when the tab regains focus, in case the key was
  // just added in another tab).
  useEffect(() => {
    const read = () => setConfig(getAiConfig());
    read();
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, []);

  const configured = Boolean(config && hasAiKey());

  async function run(selected: InsightLens) {
    if (!config) return;
    setLens(selected);
    setIsLoading(true);
    setError("");
    setResult("");
    try {
      const context = buildPortfolioContext(data, config.includeDollars);
      const text = await generateInsight(config, selected, context);
      setResult(text);
    } catch (err) {
      setError((err as Error)?.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          AI insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!configured ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            Add an AI provider key (OpenAI, Claude, or Gemini) in{" "}
            <Link
              href={`${BASE_PATH}/sync-settings`}
              className="font-medium text-foreground underline"
            >
              Settings
            </Link>{" "}
            to get insights on your portfolio. Your key stays in this browser.
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Sends a {config?.includeDollars ? "" : "no-dollar "}summary of your
              holdings to {config ? PROVIDER_LABELS[config.provider] : "your provider"} only
              when you click below.
            </p>
            <div className="flex flex-wrap gap-2">
              {INSIGHT_LENSES.map((option) => (
                <Button
                  key={option.id}
                  size="sm"
                  variant={lens.id === option.id ? "default" : "outline"}
                  disabled={isLoading || data.holdings.length === 0}
                  onClick={() => void run(option)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {data.holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Import holdings first to generate insights.
              </p>
            ) : null}

            {isLoading ? (
              <p className="animate-pulse text-sm text-muted-foreground">
                Analyzing your portfolio…
              </p>
            ) : null}

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {result ? (
              <div className="rounded-md border bg-card p-4">
                <SimpleMarkdown text={result} />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
