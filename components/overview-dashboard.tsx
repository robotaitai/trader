"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockHistoricalValues } from "@/lib/mock-data";
import { usePortfolioData } from "@/lib/storage";
import { formatCurrency, formatPct, pnlClass } from "@/lib/utils";

const sectorColors = [
  "#111827",
  "#374151",
  "#6b7280",
  "#10b981",
  "#ef4444",
  "#9ca3af",
  "#d1d5db",
  "#030712",
];

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={[
            "text-2xl font-semibold tracking-tight",
            tone === "positive" ? "text-emerald-700" : "",
            tone === "negative" ? "text-red-700" : "",
          ].join(" ")}
        >
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

export function OverviewDashboard() {
  const { holdings, summary, sectorExposure, topWinnersLosers } =
    usePortfolioData();
  const history = mockHistoricalValues.map((point, index, items) => {
    const scale =
      items[items.length - 1].value === 0
        ? 1
        : summary.portfolioValue / items[items.length - 1].value;
    return { ...point, value: Math.round(point.value * scale) };
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Overview"
        title="Portfolio command center"
        description="A local-first view of positions, exposure, concentration, and current unrealized performance."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Portfolio Value"
          value={formatCurrency(summary.portfolioValue)}
          detail={`${holdings.length} active positions`}
        />
        <MetricCard
          label="Unrealized P&L"
          value={formatCurrency(summary.unrealizedPnl)}
          detail={formatPct(summary.unrealizedPnlPct)}
          tone={summary.unrealizedPnl >= 0 ? "positive" : "negative"}
        />
        <MetricCard
          label="Realized P&L"
          value={formatCurrency(summary.realizedPnl)}
          detail="Basic placeholder for Phase 1"
        />
        <MetricCard
          label="Estimated XIRR"
          value={summary.estimatedXirr}
          detail="Cash-flow engine not enabled yet"
        />
        <MetricCard
          label="HHI Concentration"
          value={summary.hhi.toLocaleString()}
          detail="0 diversified, 10,000 concentrated"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ left: 0, right: 12 }}>
                <defs>
                  <linearGradient id="valueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${Number(value) / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#111827"
                  fill="url(#valueFill)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sector Allocation</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorExposure}
                  dataKey="value"
                  nameKey="sector"
                  innerRadius={64}
                  outerRadius={104}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {sectorExposure.map((sector, index) => (
                    <Cell
                      key={sector.sector}
                      fill={sectorColors[index % sectorColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    String(name),
                  ]}
                  contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Winners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topWinnersLosers.winners.map((item) => (
              <div key={item.ticker} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{item.ticker}</div>
                  <div className="text-xs text-muted-foreground">{item.name}</div>
                </div>
                <div className="text-right">
                  <div className={pnlClass(item.unrealizedPnl)}>
                    {formatCurrency(item.unrealizedPnl)}
                  </div>
                  <div className={pnlClass(item.unrealizedPnlPct)}>
                    {formatPct(item.unrealizedPnlPct)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Losers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topWinnersLosers.losers.map((item) => (
              <div key={item.ticker} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{item.ticker}</div>
                  <div className="text-xs text-muted-foreground">{item.name}</div>
                </div>
                <div className="text-right">
                  <div className={pnlClass(item.unrealizedPnl)}>
                    {formatCurrency(item.unrealizedPnl)}
                  </div>
                  <div className={pnlClass(item.unrealizedPnlPct)}>
                    {formatPct(item.unrealizedPnlPct)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
