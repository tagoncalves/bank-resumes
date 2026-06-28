"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatARS } from "@/lib/formatters";
import { PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SavingsWidget({
  cumulativeNetSavings,
  averageMonthlyNet,
  periodLabel,
}: {
  cumulativeNetSavings: number;
  averageMonthlyNet: number;
  periodLabel: string;
}) {
  return (
    <Card className="responsive-card overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
          <PiggyBank className="h-4 w-4 text-saving" />
          Ahorro neto acumulado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("fluid-metric-xl font-mono font-semibold tabular-nums", cumulativeNetSavings >= 0 ? "text-income" : "text-expense")}>
          {formatARS(cumulativeNetSavings)}
        </p>
        <div className="fluid-subtle mt-2 text-muted">{periodLabel}</div>
        <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <span className="min-w-0 text-muted">Promedio mensual neto</span>
          <span className={cn("fluid-money-small min-w-0 text-right font-mono tabular-nums", averageMonthlyNet >= 0 ? "text-income" : "text-expense")}>
            {formatARS(averageMonthlyNet)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
