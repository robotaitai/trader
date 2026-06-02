"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc";

export type SortColumn<T> = {
  id: string;
  getValue: (row: T) => Date | number | string | null | undefined;
};

type SortConfig = {
  id: string;
  direction: SortDirection;
};

function normalizeSortValue(value: Date | number | string | null | undefined) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (/^\d{4}-\d{2}/.test(value) && !Number.isNaN(timestamp)) {
      return timestamp;
    }
    return value.toLowerCase();
  }
  return "";
}

export function useSortableData<T>(
  data: T[],
  columns: Array<SortColumn<T>>,
  initialSort: SortConfig,
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialSort);
  const sortedData = useMemo(() => {
    const column = columns.find((item) => item.id === sortConfig.id);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const aValue = normalizeSortValue(column.getValue(a));
      const bValue = normalizeSortValue(column.getValue(b));

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [columns, data, sortConfig]);

  function toggleSort(id: string) {
    setSortConfig((current) => ({
      id,
      direction:
        current.id === id && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return { sortedData, sortConfig, toggleSort };
}

export function SortableTableHead({
  id,
  label,
  align = "left",
  sortConfig,
  onSort,
}: {
  id: string;
  label: string;
  align?: "left" | "right";
  sortConfig: SortConfig;
  onSort: (id: string) => void;
}) {
  const active = sortConfig.id === id;

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 px-2 text-xs uppercase tracking-normal text-muted-foreground",
          align === "left" ? "-ml-2" : "-mr-2",
          active && "text-gray-950",
        )}
        onClick={() => onSort(id)}
      >
        {label}
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    </TableHead>
  );
}
