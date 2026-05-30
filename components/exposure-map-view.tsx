"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { InsightList } from "@/components/insight-list";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildExposureTiles,
  generateExposureInsights,
  getExposureRole,
} from "@/lib/portfolio-lab";
import { usePortfolioData } from "@/lib/storage";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatPct,
  pnlClass,
} from "@/lib/utils";

function pnlDotClass(value: number) {
  if (value > 0) return "border-l-emerald-600";
  if (value < 0) return "border-l-red-600";
  return "border-l-gray-300";
}

export function ExposureMapView() {
  const { holdings, closedPositions, sectorExposure, summary } = usePortfolioData();
  const tiles = buildExposureTiles(holdings);
  const insights = generateExposureInsights(
    holdings,
    sectorExposure,
    summary.hhi,
  );
  const largestHolding = [...holdings].sort(
    (a, b) => b.weightPct - a.weightPct,
  )[0];
  const topThreeWeight = [...holdings]
    .sort((a, b) => b.weightPct - a.weightPct)
    .slice(0, 3)
    .reduce((sum, holding) => sum + holding.weightPct, 0);
  const tilesBySector = sectorExposure.map((sector) => ({
    ...sector,
    positions: tiles
      .filter((tile) => tile.sector === sector.sector)
      .sort((a, b) => b.weightPct - a.weightPct),
  }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Exposure Map"
        title="Where portfolio risk is actually sitting"
        description="Scan active holdings by sector, weight, concentration, and unrealized return. The notes are local deterministic agent reads."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">Largest Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {largestHolding?.ticker ?? "-"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {largestHolding
                ? `${largestHolding.weightPct.toFixed(2)}% of portfolio`
                : "No holdings"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">Top 3 Weight</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {topThreeWeight.toFixed(2)}%
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Combined exposure of largest positions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">HHI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {summary.hhi.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Position concentration score
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">Sectors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {sectorExposure.length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Active sector buckets
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sector Risk Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-950" />
                Larger bar means higher sector weight
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />
                Green position is up
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-700" />
                Red position is down
              </span>
            </div>

            <div className="space-y-4">
              {tilesBySector.map((sector) => (
                <div key={sector.sector} className="rounded-lg border bg-white p-4">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{sector.sector}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {sector.positions.length} position{sector.positions.length === 1 ? "" : "s"} · {formatCurrency(sector.value)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums">
                        {sector.weightPct.toFixed(1)}%
                      </div>
                      <div className={pnlClass(sector.unrealizedPnl)}>
                        {formatCurrency(sector.unrealizedPnl)}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${sector.weightPct >= 40 ? "bg-red-700" : "bg-gray-950"}`}
                      style={{ width: `${Math.min(sector.weightPct, 100)}%` }}
                    />
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {sector.positions.map((tile) => (
                      <div
                        key={tile.ticker}
                        className={`rounded-md border border-l-4 bg-gray-50 p-3 ${pnlDotClass(tile.unrealizedPnlPct)}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold">{tile.ticker}</div>
                            <div className="max-w-44 truncate text-xs text-muted-foreground">
                              {tile.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium tabular-nums">
                              {tile.weightPct.toFixed(2)}%
                            </div>
                            <div className={`text-xs tabular-nums ${pnlClass(tile.unrealizedPnlPct)}`}>
                              {formatPct(tile.unrealizedPnlPct)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sector Weight</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sectorExposure}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 16 }}
              >
                <CartesianGrid stroke="#e5e7eb" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="sector"
                  tickLine={false}
                  axisLine={false}
                  width={96}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "Weight"]}
                  contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                />
                <Bar dataKey="weightPct" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {sectorExposure.map((sector) => (
                    <Cell
                      key={sector.sector}
                      fill={sector.weightPct >= 40 ? "#dc2626" : "#111827"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Exposure Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Unrealized %</TableHead>
                  <TableHead>Portfolio Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiles.map((tile) => (
                  <TableRow key={tile.ticker}>
                    <TableCell className="font-semibold">{tile.ticker}</TableCell>
                    <TableCell>{tile.sector}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(tile.marketValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tile.weightPct.toFixed(2)}%
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${pnlClass(tile.unrealizedPnlPct)}`}>
                      {formatPct(tile.unrealizedPnlPct)}
                    </TableCell>
                    <TableCell>{getExposureRole(tile)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <InsightList title="Local Agent Exposure Scan" insights={insights} />
      </div>

      {closedPositions.length > 0 ? (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Closed Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-md border bg-gray-50 p-3 text-sm text-muted-foreground">
              These positions are not part of active exposure. They are shown as
              realized history so past trades do not pollute current risk.
            </div>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost Basis</TableHead>
                  <TableHead className="text-right">Proceeds</TableHead>
                  <TableHead className="text-right">Realized P&L</TableHead>
                  <TableHead className="text-right">Realized %</TableHead>
                  <TableHead>Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedPositions.map((position) => (
                  <TableRow key={`${position.ticker}-${position.soldDate ?? "closed"}`}>
                    <TableCell className="font-semibold">{position.ticker}</TableCell>
                    <TableCell>{position.sector}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {position.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(position.costBasis)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(position.proceeds)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${pnlClass(position.realizedPnl)}`}>
                      {formatCurrencyPrecise(position.realizedPnl)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${pnlClass(position.realizedPnlPct)}`}>
                      {formatPct(position.realizedPnlPct)}
                    </TableCell>
                    <TableCell>{position.soldDate ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}
