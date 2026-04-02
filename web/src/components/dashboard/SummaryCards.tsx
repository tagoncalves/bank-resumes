"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatARS, formatUSD } from "@/lib/formatters";
import { TrendingUp, TrendingDown, CreditCard, DollarSign, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  totalCurrentBalance: number;
  totalCurrentBalanceUsd: number;
  totalSpendingThisMonth: number;
  totalSpendingLastMonth: number;
  spendingChangePercent: number;
  totalFees: number;
}

export default function SummaryCards({
  totalCurrentBalance,
  totalCurrentBalanceUsd,
  totalSpendingThisMonth,
  totalSpendingLastMonth,
  spendingChangePercent,
  totalFees,
}: SummaryCardsProps) {
  const isUp = spendingChangePercent > 0;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <MetricCard
        label="Saldo total ARS"
        value={formatARS(totalCurrentBalance)}
        icon={<CreditCard className="h-4 w-4 text-indigo-600" />}
        sub="Suma de resúmenes activos"
        valueClass="text-zinc-900"
      />
      <MetricCard
        label="Saldo total USD"
        value={formatUSD(totalCurrentBalanceUsd)}
        icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
        sub="Saldo en dólares"
        valueClass="text-zinc-900"
      />
      <MetricCard
        label="Gastos este mes"
        value={formatARS(totalSpendingThisMonth)}
        icon={
          isUp ? (
            <TrendingUp className="h-4 w-4 text-red-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-emerald-500" />
          )
        }
        sub={
          <span className={cn("text-xs", isUp ? "text-red-500" : "text-emerald-600")}>
            {isUp ? "+" : ""}
            {spendingChangePercent.toFixed(1)}% vs mes anterior ({formatARS(totalSpendingLastMonth)})
          </span>
        }
        valueClass={cn(isUp ? "text-red-600" : "text-zinc-900")}
      />
      <MetricCard
        label="Comisiones e impuestos"
        value={formatARS(totalFees)}
        icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
        sub="Período analizado"
        valueClass="text-amber-600"
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          {icon}
        </div>
        <p className={cn("mt-2 text-2xl font-semibold font-mono tabular-nums", valueClass)}>
          {value}
        </p>
        <div className="mt-1 text-xs text-zinc-400">{sub}</div>
      </CardContent>
    </Card>
  );
}
