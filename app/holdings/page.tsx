"use client";

import { AppShell } from "@/components/app-shell";
import { HoldingsTable } from "@/components/holdings-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePortfolioData } from "@/lib/storage";

export default function HoldingsPage() {
  const { dataSource, holdings, loadDemoData } = usePortfolioData();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Holdings"
        title="Position ledger"
        description={
          dataSource === "snapshot"
            ? "Sortable holdings built from your saved current portfolio snapshot."
            : dataSource === "transactions"
              ? "Sortable holdings built from the transaction ledger using average cost."
              : "No active portfolio is saved yet. Import or paste your holdings in Sync Settings."
        }
      />
      {holdings.length > 0 ? (
        <HoldingsTable holdings={holdings} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div>
              <div className="text-lg font-semibold">No holdings saved locally</div>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
                Go to Sync Settings and paste or upload your current portfolio
                status table. Demo holdings are no longer loaded automatically.
              </p>
            </div>
            <Button variant="outline" onClick={loadDemoData}>
              Load demo data
            </Button>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
