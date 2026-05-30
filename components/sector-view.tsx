"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AppShell } from "@/components/app-shell";
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
import { usePortfolioData } from "@/lib/storage";
import { formatCurrencyPrecise, pnlClass } from "@/lib/utils";

const sectorColors = ["#111827", "#374151", "#6b7280", "#10b981", "#ef4444", "#9ca3af"];

export function SectorView() {
  const { sectorExposure } = usePortfolioData();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Sectors"
        title="Exposure by economic sector"
        description="Aggregated value, basis, weight, and unrealized return by sector."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sector Aggregation</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Cost Basis</TableHead>
                  <TableHead className="text-right">Unrealized P&L</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Positions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectorExposure.map((sector) => (
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation Chart</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorExposure}
                  dataKey="value"
                  nameKey="sector"
                  innerRadius={76}
                  outerRadius={126}
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
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
