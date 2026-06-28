import Link from "next/link";
import { getStatements } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatARS, formatDate, formatMonthYear } from "@/lib/formatters";
import { dateInputValue } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { FileText, ArrowRight } from "lucide-react";
import OpenUploadButton from "@/components/upload/OpenUploadButton";
import { StatementPayButton } from "@/components/statements/statement-pay-button";
import { toMoneyNumber } from "@/lib/money";

const BANK_COLORS: Record<string, string> = {
  BBVA: "bg-blue-100 text-blue-700",
  Galicia: "bg-red-100 text-red-700",
};

export default async function StatementsPage() {
  const session = await getSession();
  const { statements, total } = await getStatements(1, 50, undefined, session?.userId);

  const statementIds = statements.map((s) => s.id);
  const paymentGroups = statementIds.length > 0
    ? await prisma.transaction.groupBy({
        by: ["statementId"],
        where: { statementId: { in: statementIds }, transactionType: "DEBIT", deletedAt: null },
        _sum: { amountArs: true, amountUsd: true },
      })
    : [];
  const paymentMap = new Map(
    paymentGroups.map((g) => [
      g.statementId,
      { amountArs: toMoneyNumber(g._sum.amountArs), amountUsd: toMoneyNumber(g._sum.amountUsd) },
    ]),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {total} resumen{total !== 1 ? "es" : ""} importado{total !== 1 ? "s" : ""}
        </p>
      </div>

      {statements.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-600">No hay resúmenes</p>
          <p className="mt-1 text-xs text-zinc-400">
            Importá tu primer PDF desde la sección Importar
          </p>
          <OpenUploadButton
            kind="statement"
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Importar
          </OpenUploadButton>
        </Card>
      ) : (
        <div className="space-y-2">
          {statements.map((s) => (
            <Link key={s.id} href={`/statements/${s.id}`}>
              <Card className="flex items-center gap-4 px-5 py-4 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${BANK_COLORS[s.bankName] ?? "bg-zinc-100 text-zinc-700"}`}
                    >
                      {s.bankName}
                    </span>
                    <span className="text-sm font-medium text-zinc-800">
                      •••• {s.card.lastFour}
                    </span>
                    <span className="text-xs text-zinc-400">{s.card.cardNetwork}</span>
                    {s.importMethod === "AI" && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${["REVIEW_REQUIRED", "PRELIMINARY"].includes(s.processingStatus) ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
                        {["REVIEW_REQUIRED", "PRELIMINARY"].includes(s.processingStatus) ? "AI · revisar" : "AI"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                    <span>Cierre: {formatDate(s.periodEnd)}</span>
                    <span>Vto: {formatDate(s.dueDate)}</span>
                    <span>{s._count.transactions} movimientos</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-semibold text-red-600 tabular-nums">
                    {formatARS(s.balanceSummary?.currentBalance ?? 0)}
                  </p>
                  <StatementPayButton
                    statementId={s.id}
                    currencies={(() => {
                      const paid = paymentMap.get(s.id) ?? { amountArs: 0, amountUsd: 0 };
                      const bs = s.balanceSummary;
                      const list: Array<{ code: string; total: number; minimum: number; paid: number }> = [];
                      if (bs) {
                        list.push({ code: "ARS", total: bs.currentBalance, minimum: bs.minimumPayment, paid: paid.amountArs });
                        if (bs.currentBalanceUsd) {
                          list.push({ code: "USD", total: bs.currentBalanceUsd, minimum: 0, paid: paid.amountUsd });
                        }
                      }
                      return list;
                    })()}
                    dueDate={dateInputValue(s.dueDate)}
                    bankName={s.bankName}
                    cardLastFour={s.card.lastFour}
                    periodLabel={formatMonthYear(s.periodEnd)}
                    trigger={
                      <span className="group cursor-pointer">
                        {(() => {
                          const paid = paymentMap.get(s.id);
                          if (paid && paid.amountArs > 0) {
                            return (
                              <>
                                <span className="text-xs text-emerald-600 font-medium group-hover:hidden">
                                  Pagado: {formatARS(paid.amountArs)}
                                </span>
                                <span className="hidden group-hover:inline text-xs text-emerald-600 font-medium underline decoration-dotted underline-offset-2">
                                  Registrar pago
                                </span>
                              </>
                            );
                          }
                          return (
                            <>
                              <span className="text-xs text-zinc-400 group-hover:hidden">
                                Pago mínimo: {formatARS(s.balanceSummary?.minimumPayment ?? 0)}
                              </span>
                              <span className="hidden group-hover:inline text-xs text-emerald-600 font-medium underline decoration-dotted underline-offset-2">
                                Registrar pago
                              </span>
                            </>
                          );
                        })()}
                      </span>
                    }
                  />
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-300 flex-shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
