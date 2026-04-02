import { notFound } from "next/navigation";
import Link from "next/link";
import { getStatementById } from "@/lib/data";
import { formatARS, formatUSD, formatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function StatementDetailPage({ params }: { params: { id: string } }) {
  const data = await getStatementById(params.id);
  if (!data) notFound();

  const { card, balanceSummary: bs, transactions } = data;

  return (
    <div className="space-y-5">
      <Link
        href="/statements"
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft className="h-4 w-4" /> Resúmenes
      </Link>

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
                <span>
                  Período: {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
                </span>
                <span>Vencimiento: {formatDate(data.dueDate)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold font-mono text-zinc-900 tabular-nums">
                {formatARS(bs?.currentBalance ?? 0)}
              </p>
              {bs?.currentBalanceUsd ? (
                <p className="text-sm font-mono text-zinc-500">
                  {formatUSD(bs.currentBalanceUsd)}
                </p>
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
                <SummaryRow
                  label="Comisión cuenta full"
                  value={formatARS(bs.commissionCuentaFull)}
                />
                <SummaryRow label="Impuesto de sello" value={formatARS(bs.selloTax)} />
                <SummaryRow label="IVA" value={formatARS(bs.ivaTax)} />
                <SummaryRow label="IIBB" value={formatARS(bs.iibbTax)} />
                <SummaryRow
                  label="Intereses financ."
                  value={formatARS(bs.financingInterest)}
                />
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

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">
            Movimientos ({transactions.length})
          </CardTitle>
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
                    {t.category ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: `${t.category.color ?? "#94A3B8"}20`,
                          color: t.category.color ?? "#94A3B8",
                        }}
                      >
                        {t.category.name}
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono font-medium tabular-nums text-zinc-800">
                    {formatARS(t.amountArs)}
                    {t.amountUsd ? (
                      <span className="ml-1 text-xs text-zinc-400">
                        ({formatUSD(t.amountUsd)})
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
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
