"use client";

import { useState, useEffect } from "react";
import { formatARS, formatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, TrendingDown, Calendar, Repeat } from "lucide-react";

interface InstallmentRow {
  merchantName: string;
  amountArs: number;
  amountUsd: number | null;
  cardLastFour: string | null;
  totalInstallments: number;
  currentInstallment: number;
  remaining: number;
  lastDate: string;
  nextInstallmentDate: string;
  estimatedEndDate: string;
}

interface CashFlowPoint {
  month: string;
  recurringIncome: number;
  recurringExpense: number;
  subscriptionExpense: number;
  installmentExpense: number;
  variableExpense: number;
  variableIncome: number;
  totalIncome: number;
  totalExpense: number;
  net: number;
  cumulative: number;
}

interface CashFlowData {
  projection: CashFlowPoint[];
  meta?: {
    mode: string;
    startsAtMonth: string | null;
    endsAtMonth: string | null;
    months: number;
    lookbackMonths: number;
  };
  breakdown: {
    recurringIncome: number;
    recurringExpense: number;
    subscriptionExpense: number;
    subscriptionDetails: Array<{ merchant: string; monthlyAvg: number }>;
    variableIncome: number;
    variableExpense: number;
    baseMonthlyExpense: number;
    maxMonthlyProjectedExpense: number;
    incomeMonthsCount: number;
    expenseMonthsCount: number;
    recurringIncomeRulesCount: number;
    recurringExpenseRulesCount: number;
    variableIncomeConfidence: "LOW" | "MEDIUM" | "HIGH";
    variableExpenseConfidence: "LOW" | "MEDIUM" | "HIGH";
  };
  pendingInstallments: {
    totalAmount: number;
    byMonth: Record<string, number>;
  };
}

export default function ProjectionsPage() {
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [cashflow, setCashflow] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [instRes, cfRes] = await Promise.all([
          fetch("/api/projections/installments"),
          fetch("/api/projections/cashflow?months=12&lookback=6"),
        ]);
        if (!instRes.ok || !cfRes.ok) throw new Error("Error al cargar proyecciones");
        const [instData, cfData] = await Promise.all([instRes.json(), cfRes.json()]);
        setInstallments(instData.data ?? []);
        setCashflow(cfData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        Cargando proyecciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-red-600">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  const totalPendingInstallments = Math.round(installments.reduce(
    (s, r) => s + r.amountArs * r.remaining,
    0,
  ));

  const baseMonthlyExpense = cashflow?.breakdown.baseMonthlyExpense ?? 0;
  const maxMonthlyProjectedExpense = cashflow?.breakdown.maxMonthlyProjectedExpense ?? baseMonthlyExpense;
  const projectionRows = cashflow ? [...cashflow.projection].sort((a, b) => a.month.localeCompare(b.month)) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-zinc-900">Proyección financiera</h1>

      {/* === Resumen mensual === */}
      {cashflow && (
        <div className="responsive-grid-compact">
          <Card className="responsive-card overflow-hidden">
            <CardContent className="p-4">
              <p className="fluid-label text-zinc-500">Ingresos fijos recurrentes</p>
              <p className="fluid-money-small mt-1 font-mono font-semibold text-emerald-600 tabular-nums">
                {formatARS(cashflow.breakdown.recurringIncome)}
              </p>
              <p className="text-[10px] text-zinc-400">
                {cashflow.breakdown.recurringIncomeRulesCount > 0
                  ? `${cashflow.breakdown.recurringIncomeRulesCount} reglas recurrentes activas`
                  : "Sin reglas recurrentes activas"}
              </p>
            </CardContent>
          </Card>
          <Card className="responsive-card overflow-hidden">
            <CardContent className="p-4">
              <p className="fluid-label text-zinc-500">Ingreso variable mensual estimado</p>
              <p className="fluid-money-small mt-1 font-mono font-semibold text-emerald-600 tabular-nums">
                {formatARS(cashflow.breakdown.variableIncome)}
              </p>
              <p className="text-[10px] text-zinc-400">
                Promedio calculado con {cashflow.breakdown.incomeMonthsCount} de los últimos {cashflow.meta?.lookbackMonths ?? 6} meses disponibles
              </p>
              <p className={`text-[10px] font-medium ${confidenceClass(cashflow.breakdown.variableIncomeConfidence)}`}>
                Confianza {confidenceLabel(cashflow.breakdown.variableIncomeConfidence)}
              </p>
            </CardContent>
          </Card>
          <Card className="responsive-card overflow-hidden">
            <CardContent className="p-4">
              <p className="fluid-label text-zinc-500">Gastos fijos recurrentes</p>
              <p className="fluid-money-small mt-1 font-mono font-semibold text-red-600 tabular-nums">
                {formatARS(cashflow.breakdown.recurringExpense)}
              </p>
              <p className="text-[10px] text-zinc-400">
                {cashflow.breakdown.recurringExpenseRulesCount > 0
                  ? `${cashflow.breakdown.recurringExpenseRulesCount} reglas recurrentes activas`
                  : "Sin reglas recurrentes activas"}
              </p>
              {cashflow.breakdown.subscriptionExpense > 0 && (
                <p className="text-[10px] text-zinc-400">
                  +{formatARS(cashflow.breakdown.subscriptionExpense)} suscripciones
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="responsive-card overflow-hidden">
            <CardContent className="p-4">
              <p className="fluid-label text-zinc-500">Gastos variables estimados</p>
              <p className="fluid-money-small mt-1 font-mono font-semibold text-red-600 tabular-nums">
                {formatARS(cashflow.breakdown.variableExpense)}
              </p>
              <p className="text-[10px] text-zinc-400">
                Promedio calculado con {cashflow.breakdown.expenseMonthsCount} de los últimos {cashflow.meta?.lookbackMonths ?? 6} meses disponibles
              </p>
              <p className={`text-[10px] font-medium ${confidenceClass(cashflow.breakdown.variableExpenseConfidence)}`}>
                Confianza {confidenceLabel(cashflow.breakdown.variableExpenseConfidence)}
              </p>
            </CardContent>
          </Card>
          <Card className="responsive-card overflow-hidden">
            <CardContent className="p-4">
              <p className="fluid-label text-zinc-500">Cuotas futuras pendientes</p>
              <p className="fluid-money-small mt-1 font-mono font-semibold text-red-600 tabular-nums">
                {formatARS(cashflow.pendingInstallments.totalAmount)}
              </p>
              <p className="text-[10px] text-zinc-400">Solo cuotas con fecha efectiva futura</p>
            </CardContent>
          </Card>
          <Card className="responsive-card overflow-hidden">
            <CardContent className="p-4">
              <p className="fluid-label text-zinc-500">Gasto mensual base, sin cuotas</p>
              <p className="fluid-money-small mt-1 font-mono font-semibold text-red-600 tabular-nums">
                {formatARS(baseMonthlyExpense)}
              </p>
              <p className="text-[10px] text-zinc-400">Recurrentes + suscripciones + variable estimado</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === Suscripciones === */}
      {cashflow && cashflow.breakdown.subscriptionDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <Repeat className="h-4 w-4" />
              Suscripciones activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {cashflow.breakdown.subscriptionDetails.map((s) => (
                <div key={s.merchant} className="flex min-w-0 justify-between gap-3">
                  <span className="min-w-0 truncate text-zinc-700">{s.merchant}</span>
                  <span className="shrink-0 font-mono text-red-600 tabular-nums">
                    {formatARS(s.monthlyAvg)} / mes
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Proyección de flujo de caja === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <TrendingUp className="h-4 w-4" />
            Proyección mes a mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cashflow && projectionRows.length > 0 ? (
            <div className="responsive-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs text-zinc-500">
                    <th className="px-3 py-2 text-left font-medium">Mes</th>
                    <th className="px-3 py-2 text-right font-medium">Ingresos fijos</th>
                    <th className="px-3 py-2 text-right font-medium">Ingreso variable mensual estimado</th>
                    <th className="px-3 py-2 text-right font-medium">Gasto fijo</th>
                    <th className="px-3 py-2 text-right font-medium text-red-500">Suscripciones</th>
                    <th className="px-3 py-2 text-right font-medium text-red-500">Cuotas futuras</th>
                    <th className="px-3 py-2 text-right font-medium">Gasto variable estimado</th>
                    <th className="px-3 py-2 text-right font-medium">Total gastos</th>
                    <th className="px-3 py-2 text-right font-medium">Neto</th>
                    <th className="px-3 py-2 text-right font-medium">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionRows.map((p, index) => {
                    const label = monthLabel(p.month);
                    return (
                      <tr key={`${p.month}-${index}`} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">{label}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600 tabular-nums">
                          {p.recurringIncome > 0 ? formatARS(p.recurringIncome) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600 tabular-nums">
                          {p.variableIncome > 0 ? formatARS(p.variableIncome) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-red-600 tabular-nums">
                          {p.recurringExpense > 0 ? formatARS(p.recurringExpense) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-red-500 tabular-nums">
                          {p.subscriptionExpense > 0 ? formatARS(p.subscriptionExpense) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-red-500 tabular-nums">
                          {p.installmentExpense > 0 ? formatARS(p.installmentExpense) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-red-600 tabular-nums">
                          {formatARS(p.variableExpense)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-red-600 tabular-nums">
                          {formatARS(p.totalExpense)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${
                            p.net >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {formatARS(p.net)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono text-xs font-medium tabular-nums ${
                            p.cumulative >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {formatARS(p.cumulative)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-400">
              No hay suficientes datos para proyectar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* === Cuotas pendientes === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <Calendar className="h-4 w-4" />
            Cuotas pendientes
            {installments.length > 0 && (
              <span className="ml-auto text-xs font-normal text-zinc-400">
                {installments.reduce((s, r) => s + r.remaining, 0)} cuotas ·{" "}
                {formatARS(totalPendingInstallments)} restantes
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {installments.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              No tenés compras en cuotas pendientes.
            </p>
          ) : (
            <div className="responsive-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs text-zinc-500">
                    <th className="px-3 py-2 text-left font-medium">Comercio</th>
                    <th className="px-3 py-2 text-right font-medium">Cuota</th>
                    <th className="px-3 py-2 text-right font-medium">Monto</th>
                    <th className="px-3 py-2 text-right font-medium">Restantes</th>
                    <th className="px-3 py-2 text-right font-medium">Próxima</th>
                    <th className="px-3 py-2 text-right font-medium">Fin</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((row, i) => (
                    <tr
                      key={`${row.merchantName}-${row.amountArs}-${i}`}
                      className="border-b border-zinc-50 hover:bg-zinc-50/50"
                    >
                      <td className="px-3 py-2">
                        <span className="text-sm text-zinc-800">{row.merchantName}</span>
                        {row.cardLastFour && (
                          <span className="ml-1.5 text-[10px] text-zinc-400">
                            ·•••{row.cardLastFour}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 tabular-nums">
                        {row.currentInstallment}/{row.totalInstallments}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-red-600 tabular-nums">
                        {formatARS(row.amountArs)}
                        {row.amountUsd != null && (
                          <span className="ml-1 text-[10px] text-zinc-400">
                            USD {row.amountUsd.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-zinc-800 tabular-nums">
                        {row.remaining}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 tabular-nums">
                        {formatDate(row.nextInstallmentDate)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 tabular-nums">
                        {formatDate(row.estimatedEndDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* === Resumen proyectado === */}
      {cashflow && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <TrendingDown className="h-4 w-4" />
              Resumen proyectado (mensual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                  <span className="text-zinc-500">Ingresos fijos recurrentes</span>
                <span className="font-mono text-emerald-600 tabular-nums">
                  {formatARS(cashflow.breakdown.recurringIncome)}
                </span>
              </div>
              {cashflow.breakdown.variableIncome > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ingreso variable mensual estimado</span>
                  <span className="font-mono text-emerald-600 tabular-nums">
                    {formatARS(cashflow.breakdown.variableIncome)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                  <span className="text-zinc-500">Gastos fijos recurrentes</span>
                <span className="font-mono text-red-600 tabular-nums">
                  {formatARS(cashflow.breakdown.recurringExpense)}
                </span>
              </div>
              {cashflow.breakdown.subscriptionExpense > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Suscripciones</span>
                  <span className="font-mono text-red-600 tabular-nums">
                    {formatARS(cashflow.breakdown.subscriptionExpense)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                  <span className="text-zinc-500">Gastos variables estimados</span>
                <span className="font-mono text-red-600 tabular-nums">
                  {formatARS(cashflow.breakdown.variableExpense)}
                </span>
              </div>
              {totalPendingInstallments > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Cuotas futuras pendientes</span>
                  <span className="font-mono text-red-600 tabular-nums">
                    {formatARS(totalPendingInstallments)}
                  </span>
                </div>
              )}
              <div className="border-t border-zinc-100 pt-2">
                <div className="flex justify-between font-medium">
                  <span className="text-zinc-700">Gasto mensual base, sin cuotas</span>
                  <span className="font-mono text-red-600 tabular-nums">
                    {formatARS(baseMonthlyExpense)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between font-medium">
                  <span className="text-zinc-700">Gasto mensual proyectado máximo, con cuotas</span>
                  <span className="font-mono text-red-600 tabular-nums">
                    {formatARS(maxMonthlyProjectedExpense)}
                  </span>
                </div>
              </div>
              <div className="border-t border-zinc-100 pt-2">
                {(() => {
                  const last = projectionRows.at(-1);
                  return (
                    <div className="flex justify-between font-medium">
                      <span className="text-zinc-700">
                        {last && last.cumulative >= 0
                          ? "Ahorro acumulado en 12 meses"
                          : "Déficit acumulado en 12 meses"}
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          last && last.cumulative >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatARS(Math.abs(last?.cumulative ?? 0))}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function monthLabel(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
  });
}

function confidenceLabel(value: "LOW" | "MEDIUM" | "HIGH") {
  if (value === "HIGH") return "alta";
  if (value === "MEDIUM") return "media";
  return "baja";
}

function confidenceClass(value: "LOW" | "MEDIUM" | "HIGH") {
  if (value === "HIGH") return "text-emerald-600";
  if (value === "MEDIUM") return "text-amber-600";
  return "text-red-600";
}
