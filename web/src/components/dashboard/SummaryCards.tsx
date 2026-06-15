"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatARS, formatUSD } from "@/lib/formatters";
import { ArrowDownCircle, ArrowUpCircle, Scale, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  totalIncomeArs: number;
  totalExpenseArs: number;
  netBalanceArs: number;
  netBalanceUsd: number;
  periodLabel: string;
}

export default function SummaryCards({
  totalIncomeArs,
  totalExpenseArs,
  netBalanceArs,
  netBalanceUsd,
  periodLabel,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <MetricCard
        label="Ingresos del período"
        value={formatARS(totalIncomeArs)}
        icon={<ArrowUpCircle className="h-4 w-4 text-emerald-600" />}
        sub={periodLabel}
        valueClass="text-emerald-600"
      />
      <MetricCard
        label="Egresos del período"
        value={formatARS(totalExpenseArs)}
        icon={<ArrowDownCircle className="h-4 w-4 text-red-600" />}
        sub={periodLabel}
        valueClass="text-red-600"
      />
      <MetricCard
        label="Balance neto ARS"
        value={formatARS(netBalanceArs)}
        icon={<Scale className="h-4 w-4 text-indigo-600" />}
        sub={periodLabel}
        valueClass={cn(netBalanceArs >= 0 ? "text-zinc-900" : "text-red-600")}
      />
      <MetricCard
        label="Balance neto USD"
        value={formatUSD(netBalanceUsd)}
        icon={<Wallet className="h-4 w-4 text-sky-600" />}
        sub={periodLabel}
        valueClass={cn(netBalanceUsd >= 0 ? "text-zinc-900" : "text-red-600")}
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
