import Link from "next/link";
import { formatARS, formatDate } from "@/lib/formatters";
import { Card } from "@/components/ui/card";
import { FileText, ArrowRight } from "lucide-react";

interface StatementRow {
  id: string;
  bankName: string;
  cardLastFour: string;
  cardNetwork: string;
  periodEnd: string;
  dueDate: string;
  currentBalance: number;
  minimumPayment: number;
  transactionCount: number;
}

async function getStatements() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/statements?limit=50`, { cache: "no-store" });
  if (!res.ok) return { data: [], total: 0 };
  return res.json();
}

const BANK_COLORS: Record<string, string> = {
  BBVA: "bg-blue-100 text-blue-700",
  Galicia: "bg-red-100 text-red-700",
};

export default async function StatementsPage() {
  const { data: statements, total } = await getStatements();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{total} resumen{total !== 1 ? "es" : ""} importado{total !== 1 ? "s" : ""}</p>
      </div>

      {statements.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-600">No hay resúmenes</p>
          <p className="mt-1 text-xs text-zinc-400">Importá tu primer PDF desde la sección Importar</p>
          <Link
            href="/upload"
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Importar
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {statements.map((s: StatementRow) => (
            <Link key={s.id} href={`/statements/${s.id}`}>
              <Card className="flex items-center gap-4 px-5 py-4 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BANK_COLORS[s.bankName] ?? "bg-zinc-100 text-zinc-700"}`}>
                      {s.bankName}
                    </span>
                    <span className="text-sm font-medium text-zinc-800">•••• {s.cardLastFour}</span>
                    <span className="text-xs text-zinc-400">{s.cardNetwork}</span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                    <span>Cierre: {formatDate(s.periodEnd)}</span>
                    <span>Vto: {formatDate(s.dueDate)}</span>
                    <span>{s.transactionCount} movimientos</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono text-base font-semibold text-zinc-900 tabular-nums">
                    {formatARS(s.currentBalance)}
                  </p>
                  <p className="text-xs text-zinc-400">Pago mínimo: {formatARS(s.minimumPayment)}</p>
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
