import { notFound } from "next/navigation";
import Link from "next/link";
import { getStatementById } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { formatARS, formatUSD, formatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeleteStatementButton } from "@/components/ui/delete-statement-button";
import { CategoryPicker } from "@/components/ui/category-picker";
import { AddTransactionForm } from "@/components/ui/add-transaction-form";

export default async function StatementDetailPage({ params }: { params: { id: string } }) {
  const [data, categories] = await Promise.all([
    getStatementById(params.id),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!data) notFound();

  const { card, balanceSummary: bs, transactions } = data;

  // Category breakdown
  const catMap = new Map<string, { name: string; color: string | null; total: number; count: number }>();
  for (const t of transactions) {
    const key = t.category?.name ?? "Sin categoría";
    const color = t.category?.color ?? "#94A3B8";
    const existing = catMap.get(key) ?? { name: key, color, total: 0, count: 0 };
    existing.total += t.amountArs;
    existing.count += 1;
    catMap.set(key, existing);
  }
  const categoryBreakdown = Array.from(catMap.values()).sort((a, b) => b.total - a.total);
  const totalSpend = categoryBreakdown.reduce((s, c) => s + c.total, 0);

  const manualCount = transactions.filter((t) => (t as { source?: string }).source === "MANUAL").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/statements"
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" /> Resúmenes
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/statements/${params.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <FileText className="h-4 w-4" /> Ver PDF
          </a>
          <DeleteStatementButton id={params.id} />
        </div>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-zinc-900">
                {data.bankName} · {card.cardNetwork} •••• {card.lastFour}
              </p>
              <p className="text-sm text-zinc-500">{card.holderName}</p>
              <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                <span>Período: {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</span>
                <span>Vencimiento: {formatDate(data.dueDate)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold font-mono text-zinc-900 tabular-nums">
                {formatARS(bs?.currentBalance ?? 0)}
              </p>
              {bs?.currentBalanceUsd ? (
                <p className="text-sm font-mono text-zinc-500">{formatUSD(bs.currentBalanceUsd)}</p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-400">
                Pago mínimo: {formatARS(bs?.minimumPayment ?? 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance breakdown */}
      {bs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-700">Estado de cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-100 text-sm">
              <div className="space-y-2 pr-6">
                <SummaryRow label="Saldo anterior" value={formatARS(bs.previousBalance)} />
                <SummaryRow
                  label="Pagos aplicados"
                  value={`- ${formatARS(Math.abs(bs.paymentsApplied))}`}
                  valueClass="text-emerald-600"
                />
                <SummaryRow label="Consumos" value={formatARS(bs.totalConsumption)} />
              </div>
              <div className="space-y-2 pl-6">
                <SummaryRow label="Comisión cuenta full" value={formatARS(bs.commissionCuentaFull)} />
                <SummaryRow label="Impuesto de sello" value={formatARS(bs.selloTax)} />
                <SummaryRow label="IVA" value={formatARS(bs.ivaTax)} />
                <SummaryRow label="IIBB" value={formatARS(bs.iibbTax)} />
                <SummaryRow label="Intereses financ." value={formatARS(bs.financingInterest)} />
              </div>
            </div>
            {(bs.tnaArs || bs.temArs || bs.teaArs) && (
              <div className="mt-4 rounded-md bg-zinc-50 px-4 py-3">
                <p className="mb-1 text-xs font-medium text-zinc-500">Tasas de interés (ARS)</p>
                <div className="flex gap-6 text-xs font-mono text-zinc-700">
                  {bs.tnaArs && <span>TNA {bs.tnaArs.toFixed(2)}%</span>}
                  {bs.temArs && <span>TEM {bs.temArs.toFixed(3)}%</span>}
                  {bs.teaArs && <span>TEA {bs.teaArs.toFixed(2)}%</span>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-700">Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categoryBreakdown.map((cat) => {
                const pct = totalSpend > 0 ? (cat.total / totalSpend) * 100 : 0;
                return (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium w-28 text-center shrink-0"
                      style={{ background: `${cat.color ?? "#94A3B8"}20`, color: cat.color ?? "#94A3B8" }}
                    >
                      {cat.name}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct.toFixed(1)}%`, background: cat.color ?? "#94A3B8" }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-6 text-right shrink-0">{cat.count}</span>
                    <span className="text-xs font-mono font-medium text-zinc-800 tabular-nums w-28 text-right shrink-0">
                      {formatARS(cat.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-zinc-700">
              Movimientos ({transactions.length}
              {manualCount > 0 && (
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  · {manualCount} manual{manualCount !== 1 ? "es" : ""}
                </span>
              )}
              )
            </CardTitle>
            <AddTransactionForm statementId={params.id} categories={categories} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
                <th className="px-5 py-2.5 text-left font-medium">Fecha</th>
                <th className="px-5 py-2.5 text-left font-medium">Comercio</th>
                <th className="px-5 py-2.5 text-left font-medium">Categoría</th>
                <th className="px-5 py-2.5 text-right font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const isManual = (t as { source?: string }).source === "MANUAL";
                return (
                  <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-zinc-500">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-800">
                          {t.normalizedMerchant || t.merchantName}
                        </span>
                        {t.isInstallment && (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                            {t.installmentCurrent}/{t.installmentTotal}
                          </span>
                        )}
                        {isManual && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            manual
                          </span>
                        )}
                        {t.cardLastFour && (
                          <span className="text-[10px] text-zinc-400">•••{t.cardLastFour}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <CategoryPicker
                        transactionId={t.id}
                        currentCategoryId={t.categoryId}
                        categories={categories}
                      />
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono font-medium tabular-nums text-zinc-800">
                      {formatARS(t.amountArs)}
                      {t.amountUsd ? (
                        <span className="ml-1 text-xs text-zinc-400">({formatUSD(t.amountUsd)})</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("font-mono tabular-nums text-zinc-800", valueClass)}>{value}</span>
    </div>
  );
}
