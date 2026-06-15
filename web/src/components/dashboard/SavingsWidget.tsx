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
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <PiggyBank className="h-4 w-4 text-emerald-600" />
          Ahorro neto acumulado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-semibold font-mono tabular-nums", cumulativeNetSavings >= 0 ? "text-emerald-600" : "text-red-600")}>
          {formatARS(cumulativeNetSavings)}
        </p>
        <div className="mt-2 text-sm text-zinc-500">{periodLabel}</div>
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-sm">
          <span className="text-zinc-500">Promedio mensual neto</span>
          <span className={cn("font-mono tabular-nums", averageMonthlyNet >= 0 ? "text-emerald-600" : "text-red-600")}>
            {formatARS(averageMonthlyNet)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
