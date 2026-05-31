"use client";

import {
  Bar,
  BarChart,
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isFundExposureBucket } from "@/lib/security-classification";
import { usePortfolioData } from "@/lib/storage";
import type { SectorExposure } from "@/lib/types";
import { formatCurrencyPrecise, pnlClass } from "@/lib/utils";

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

function AllocationTable({
  rows,
  title,
}: {
  rows: SectorExposure[];
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Cost Basis</TableHead>
                <TableHead className="text-right">Unrealized P&L</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Positions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((sector) => (
                <TableRow key={sector.sector}>
                  <TableCell className="font-medium">{sector.sector}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(sector.value)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(sector.costBasis)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${pnlClass(sector.unrealizedPnl)}`}>
                    {formatCurrencyPrecise(sector.unrealizedPnl)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sector.weightPct.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sector.positions}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
            No active exposure in this group.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SectorView() {
  const { holdings, sectorExposure } = usePortfolioData();
  const stockSectors = sectorExposure.filter(
    (sector) => !isFundExposureBucket(sector.sector),
  );
  const fundSleeves = sectorExposure.filter((sector) =>
    isFundExposureBucket(sector.sector),
  );
  const unclassifiedHoldings = holdings.filter((holding) =>
    holding.sector.startsWith("Unclassified"),
  );
  const largestStockSector = stockSectors[0];
  const largestFundSleeve = fundSleeves[0];
  const fundWeight = fundSleeves.reduce(
    (sum, sector) => sum + sector.weightPct,
    0,
  );
  const stockWeight = stockSectors.reduce(
    (sum, sector) => sum + sector.weightPct,
    0,
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Sectors"
        title="Sector and fund-sleeve exposure"
        description="Stocks are grouped by economic sector. ETFs and funds are separated as sleeves so index exposure does not masquerade as a company sector."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Badge variant="outline">{stockWeight.toFixed(1)}% single-stock sectors</Badge>
        <Badge variant="outline">{fundWeight.toFixed(1)}% fund/index sleeves</Badge>
        <Badge variant="outline">
          {unclassifiedHoldings.length} unclassified holding
          {unclassifiedHoldings.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">Largest Stock Sector</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {largestStockSector?.sector ?? "-"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {largestStockSector
                ? `${largestStockSector.weightPct.toFixed(2)}% of active value`
                : "No stock sectors"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">Largest Fund Sleeve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {largestFundSleeve?.sector ?? "-"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {largestFundSleeve
                ? `${largestFundSleeve.weightPct.toFixed(2)}% of active value`
                : "No fund sleeves"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">Sector Buckets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stockSectors.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Economic sectors across active stocks
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">Fund Sleeves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fundSleeves.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              ETFs, indexes, option-income, and crypto sleeves
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <AllocationTable rows={stockSectors} title="Economic Sector Aggregation" />

        <Card>
          <CardHeader>
            <CardTitle>Stock Sector Weights</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            {stockSectors.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stockSectors}
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
                    width={132}
                  />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(2)}%`, "Weight"]}
                    contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                  />
                  <Bar dataKey="weightPct" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {stockSectors.map((sector, index) => (
                      <Cell
                        key={sector.sector}
                        fill={sectorColors[index % sectorColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
                No stock sector exposure yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <AllocationTable rows={fundSleeves} title="ETF / Fund Sleeve Aggregation" />

        <Card>
          <CardHeader>
            <CardTitle>Full Active Allocation</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            {sectorExposure.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorExposure}
                    dataKey="value"
                    nameKey="sector"
                    innerRadius={72}
                    outerRadius={124}
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
                      formatCurrencyPrecise(Number(value)),
                      String(name),
                    ]}
                    contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="rounded-md border bg-gray-50 p-6 text-sm text-muted-foreground">
                Import active holdings to show allocation.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {unclassifiedHoldings.length > 0 ? (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Needs Classification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              These active tickers still need a curated sector mapping before
              the allocation can be considered clean.
            </div>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Current Bucket</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unclassifiedHoldings.map((holding) => (
                  <TableRow key={holding.ticker}>
                    <TableCell className="font-semibold">{holding.ticker}</TableCell>
                    <TableCell>{holding.name}</TableCell>
                    <TableCell>{holding.sector}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(holding.marketValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {holding.weightPct.toFixed(2)}%
                    </TableCell>
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
