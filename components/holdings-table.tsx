"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Holding } from "@/lib/types";
import {
  formatCurrencyPrecise,
  formatNumber,
  formatPct,
  pnlClass,
} from "@/lib/utils";

function SortHeader({
  label,
  column,
}: {
  label: string;
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 px-2 text-xs uppercase tracking-normal text-muted-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </Button>
  );
}

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "marketValue", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("All");

  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(holdings.map((holding) => holding.sector))).sort()],
    [holdings],
  );

  const filteredData = useMemo(
    () =>
      sectorFilter === "All"
        ? holdings
        : holdings.filter((holding) => holding.sector === sectorFilter),
    [holdings, sectorFilter],
  );

  const columns = useMemo<ColumnDef<Holding>[]>(
    () => [
      {
        accessorKey: "ticker",
        header: ({ column }) => <SortHeader label="Ticker" column={column} />,
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.ticker}</div>
            <div className="text-xs text-muted-foreground">{row.original.exchange}</div>
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <div className="max-w-36 truncate">{row.original.name}</div>,
      },
      {
        accessorKey: "sector",
        header: "Sector",
        cell: ({ row }) => <div className="max-w-28 truncate">{row.original.sector}</div>,
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatNumber(row.original.quantity, 4)}
          </div>
        ),
      },
      {
        accessorKey: "avgCost",
        header: "Avg",
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrencyPrecise(row.original.avgCost, row.original.currency)}
          </div>
        ),
      },
      {
        accessorKey: "currentPrice",
        header: "Price",
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrencyPrecise(row.original.currentPrice, row.original.currency)}
          </div>
        ),
      },
      {
        accessorKey: "marketValue",
        header: ({ column }) => <SortHeader label="Mkt Value" column={column} />,
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {formatCurrencyPrecise(row.original.marketValue, row.original.currency)}
          </div>
        ),
      },
      {
        accessorKey: "unrealizedPnl",
        header: ({ column }) => <SortHeader label="P&L" column={column} />,
        cell: ({ row }) => (
          <div className={`text-right font-medium tabular-nums ${pnlClass(row.original.unrealizedPnl)}`}>
            {formatCurrencyPrecise(row.original.unrealizedPnl, row.original.currency)}
          </div>
        ),
      },
      {
        accessorKey: "unrealizedPnlPct",
        header: "Unrlzd %",
        cell: ({ row }) => (
          <div className={`text-right tabular-nums ${pnlClass(row.original.unrealizedPnlPct)}`}>
            {formatPct(row.original.unrealizedPnlPct)}
          </div>
        ),
      },
      {
        accessorKey: "weightPct",
        header: ({ column }) => <SortHeader label="Weight" column={column} />,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.weightPct.toFixed(2)}%
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search ticker, name, sector..."
            className="max-w-sm"
          />
          <select
            value={sectorFilter}
            onChange={(event) => setSectorFilter(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector === "All" ? "All sectors" : sector}
              </option>
            ))}
          </select>
        </div>

        <Table className="text-xs">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      [
                        "quantity",
                        "avgCost",
                        "currentPrice",
                        "marketValue",
                        "unrealizedPnl",
                        "unrealizedPnlPct",
                        "weightPct",
                      ].includes(header.column.id)
                        ? "text-right"
                        : ""
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No holdings match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
