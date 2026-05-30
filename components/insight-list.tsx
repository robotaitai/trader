import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LocalInsight } from "@/lib/portfolio-lab";

const severityLabels: Record<LocalInsight["severity"], string> = {
  opportunity: "Opportunity",
  risk: "Risk",
  watch: "Watch",
};

const severityClasses: Record<LocalInsight["severity"], string> = {
  opportunity: "border-emerald-200 bg-emerald-50 text-emerald-800",
  risk: "border-red-200 bg-red-50 text-red-800",
  watch: "border-gray-200 bg-gray-50 text-gray-700",
};

export function InsightList({
  title,
  insights,
}: {
  title: string;
  insights: LocalInsight[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => (
          <div key={insight.title} className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-medium">{insight.title}</div>
              <Badge className={severityClasses[insight.severity]} variant="outline">
                {severityLabels[insight.severity]}
              </Badge>
            </div>
            <p className="text-sm leading-5 text-muted-foreground">
              {insight.detail}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
