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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
          <PiggyBank className="h-4 w-4 text-saving" />
          Ahorro neto acumulado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("font-mono text-3xl font-semibold tabular-nums", cumulativeNetSavings >= 0 ? "text-income" : "text-expense")}>
          {formatARS(cumulativeNetSavings)}
        </p>
        <div className="mt-2 text-sm text-muted">{periodLabel}</div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted">Promedio mensual neto</span>
          <span className={cn("font-mono tabular-nums", averageMonthlyNet >= 0 ? "text-income" : "text-expense")}>
            {formatARS(averageMonthlyNet)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
