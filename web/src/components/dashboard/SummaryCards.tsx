"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatARS, formatUSD } from "@/lib/formatters";
import { ArrowDownCircle, ArrowUpCircle, Scale, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  totalIncomeArs: number;
  totalExpenseArs: number;
  totalCashOutflowArs: number;
  excludedOutflowArs: number;
  netBalanceArs: number;
  cashflowBalanceArs: number;
  netBalanceUsd: number;
  periodLabel: string;
}

export default function SummaryCards({
  totalIncomeArs,
  totalExpenseArs,
  totalCashOutflowArs,
  excludedOutflowArs,
  netBalanceArs,
  cashflowBalanceArs,
  netBalanceUsd,
  periodLabel,
}: SummaryCardsProps) {
  return (
    <div className="summary-card-grid">
      <MetricCard
        label="Ingresos del período"
        value={formatARS(totalIncomeArs)}
        icon={<ArrowUpCircle className="h-4 w-4 text-income" />}
        sub={periodLabel}
        valueClass="text-income"
      />
      <MetricCard
        label="Gastos computables"
        value={formatARS(totalExpenseArs)}
        icon={<ArrowDownCircle className="h-4 w-4 text-expense" />}
        sub="Consumo real, sin pagos de tarjeta ni transferencias"
        valueClass="text-expense"
      />
      <MetricCard
        label="Neto financiero ARS"
        value={formatARS(netBalanceArs)}
        icon={<Scale className="h-4 w-4 text-primary" />}
        sub="Ingresos computables - gastos computables"
        valueClass={cn(netBalanceArs >= 0 ? "text-foreground" : "text-expense")}
      />
      <MetricCard
        label="Salida real de caja"
        value={formatARS(totalCashOutflowArs)}
        icon={<Wallet className="h-4 w-4 text-saving" />}
        sub={excludedOutflowArs > 0 ? `Incluye ${formatARS(excludedOutflowArs)} en pagos/transferencias excluidas` : periodLabel}
        valueClass="text-expense"
      />
      <MetricCard
        label="Caja neta ARS"
        value={formatARS(cashflowBalanceArs)}
        icon={<Scale className="h-4 w-4 text-primary" />}
        sub="Ingresos - salidas reales de caja"
        valueClass={cn(cashflowBalanceArs >= 0 ? "text-foreground" : "text-expense")}
      />
      <MetricCard
        label="Neto financiero USD"
        value={formatUSD(netBalanceUsd)}
        icon={<Wallet className="h-4 w-4 text-saving" />}
        sub={periodLabel}
        valueClass={cn(netBalanceUsd >= 0 ? "text-foreground" : "text-expense")}
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
    <Card className="responsive-card overflow-hidden">
      <CardContent className="p-3 sm:p-4 lg:p-5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="fluid-label font-medium uppercase tracking-wide text-muted">{label}</p>
          <span className="shrink-0 pt-0.5">{icon}</span>
        </div>
        <p className={cn("fluid-metric mt-2 font-mono font-semibold tabular-nums", valueClass)}>
          {value}
        </p>
        <div className="fluid-subtle mt-1 text-muted">{sub}</div>
      </CardContent>
    </Card>
  );
}
