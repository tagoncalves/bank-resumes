import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getStatementById } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatARS, formatUSD, formatDate, formatMonthYear } from "@/lib/formatters";
import { dateInputValue } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { toMoneyNumber } from "@/lib/money";
import { DeleteStatementButton } from "@/components/ui/delete-statement-button";
import { CategoryPicker } from "@/components/ui/category-picker";
import { Badge } from "@/components/ui/badge";
import { RegisterPaymentDialog } from "@/components/statements/register-payment-dialog";

export default async function StatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const [data, categories] = await Promise.all([
    getStatementById(id, session.userId),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!data) notFound();

  const { card, balanceSummary: bs, transactions } = data;

  const paymentsSum = bs
    ? await prisma.transaction.aggregate({
        where: { statementId: id, userId: session.userId, transactionType: "DEBIT", deletedAt: null },
        _sum: { amountArs: true, amountUsd: true },
      })
    : null;
  const totalPayments = paymentsSum ? toMoneyNumber(paymentsSum._sum.amountArs) : 0;
  const totalPaymentsUsd = paymentsSum ? toMoneyNumber(paymentsSum._sum.amountUsd) : 0;
  const isFullyPaid = !!bs
    && totalPayments >= bs.currentBalance
    && (!bs.currentBalanceUsd || totalPaymentsUsd >= bs.currentBalanceUsd);

  const paymentCurrencies = bs
    ? [
        { code: "ARS" as const, total: bs.currentBalance, minimum: bs.minimumPayment, paid: totalPayments },
        ...(bs.currentBalanceUsd ? [{ code: "USD" as const, total: bs.currentBalanceUsd, minimum: 0, paid: totalPaymentsUsd }] : []),
      ]
    : [];

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

  return (
    <div className="space-y-5">
      <div className="responsive-row flex items-center justify-between gap-3">
        <Link
          href="/statements"
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" /> Resúmenes
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/statements/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <FileText className="h-4 w-4" /> Ver PDF
          </a>
          {bs && !isFullyPaid && (
            <RegisterPaymentDialog
              statementId={data.id}
              currencies={paymentCurrencies}
              dueDate={dateInputValue(data.dueDate)}
              bankName={data.bankName}
              cardLastFour={card.lastFour}
              periodLabel={formatMonthYear(data.periodEnd)}
            />
          )}
          {bs && isFullyPaid && (
            <Link
              href={`/transactions?statementId=${id}&type=CREDIT`}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50"
            >
              <CreditCard className="h-4 w-4" /> Ver pagos
            </Link>
          )}
          <DeleteStatementButton id={id} />
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
                <span>{data.importMethod === "AI" ? `Importado con AI${["REVIEW_REQUIRED", "PRELIMINARY"].includes(data.processingStatus) ? " · revisar" : ""}` : "Importado con parser nativo"}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold font-mono text-red-600 tabular-nums">
                {formatARS(bs?.currentBalance ?? 0)}
              </p>
              {bs?.currentBalanceUsd ? (
                <p className="text-sm font-mono text-red-600/70">{formatUSD(bs.currentBalanceUsd)}</p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-400">
                Pago mínimo: {formatARS(bs?.minimumPayment ?? 0)}
              </p>
            </div>
          </div>
          {data.analysisNotes && (
            <div className={`mt-4 rounded-md px-4 py-3 text-xs ${["REVIEW_REQUIRED", "PRELIMINARY"].includes(data.processingStatus) ? "bg-amber-50 text-amber-800" : "bg-violet-50 text-violet-800"}`}>
              <p className="font-medium">
                {data.analysisProvider ? "Análisis AI" : "Análisis de importación"}
                {typeof data.analysisConfidence === "number" ? ` · confianza ${(data.analysisConfidence * 100).toFixed(0)}%` : ""}
              </p>
              <p className="mt-1 whitespace-pre-line">{data.analysisNotes}</p>
            </div>
          )}
          {data.reviewNotes && (
            <div className={`mt-3 rounded-md px-4 py-3 text-xs ${data.processingStatus === "REJECTED" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
              <p className="font-medium">
                Revisión manual
                {data.reviewedBy ? ` · ${data.reviewedBy.displayName ?? data.reviewedBy.username}` : ""}
                {data.reviewedAt ? ` · ${new Date(data.reviewedAt).toLocaleString("es-AR")}` : ""}
              </p>
              <p className="mt-1 whitespace-pre-line">{data.reviewNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance breakdown */}
      {bs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-700">Estado de cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm sm:grid-cols-2 sm:divide-x sm:divide-zinc-100">
              <div className="space-y-2 sm:pr-6">
                <SummaryRow label="Saldo anterior" value={formatARS(bs.previousBalance)} />
                <SummaryRow
                  label="Pagos aplicados"
                  value={`- ${formatARS(Math.abs(bs.paymentsApplied))}`}
                  valueClass="text-emerald-600"
                />
                <SummaryRow label="Consumos" value={formatARS(bs.totalConsumption)} />
              </div>
              <div className="space-y-2 sm:pl-6">
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
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono text-zinc-700">
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
                  <div key={cat.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center sm:gap-3">
                    <span
                      className="truncate rounded-full px-2 py-0.5 text-center text-[11px] font-medium sm:w-28 sm:shrink-0"
                      style={{ background: `${cat.color ?? "#94A3B8"}20`, color: cat.color ?? "#94A3B8" }}
                    >
                      {cat.name}
                    </span>
                    <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 sm:col-span-1 sm:flex-1">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct.toFixed(1)}%`, background: cat.color ?? "#94A3B8" }}
                      />
                    </div>
                    <span className="hidden w-6 shrink-0 text-right text-xs text-zinc-400 sm:inline">{cat.count}</span>
                    <span className="fluid-money-small text-right font-mono font-medium text-red-600 tabular-nums sm:w-28 sm:shrink-0">
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
          <CardTitle className="text-sm font-medium text-zinc-700">
            Movimientos ({transactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="responsive-scroll">
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
              {transactions.map((t) => (
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
                    <td className="px-5 py-2.5 text-right font-mono font-medium tabular-nums text-red-600">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.amountUsd ? <Badge variant="outline">USD</Badge> : null}
                        {t.amountArs === 0 && t.amountUsd
                          ? formatUSD(t.amountUsd)
                          : formatARS(t.amountArs)}
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
          </div>
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
    <div className="flex min-w-0 justify-between gap-2">
      <span className="min-w-0 text-zinc-500">{label}</span>
      <span className={cn("fluid-money-small text-right font-mono tabular-nums text-red-600", valueClass)}>{value}</span>
    </div>
  );
}
