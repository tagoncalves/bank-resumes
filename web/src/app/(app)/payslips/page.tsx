import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { FileText, ArrowRight } from "lucide-react";
import { formatARS, formatDate } from "@/lib/formatters";
import { toMoneyNumber } from "@/lib/money";
import OpenUploadButton from "@/components/upload/OpenUploadButton";

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string }>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const selectedBank = sp.bank;

  const allPayslips = await prisma.payslip.findMany({
    where: { userId: session?.userId ?? null },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      bankName: true,
      employerName: true,
      rawFilename: true,
      processingStatus: true,
      periodLabel: true,
      payDate: true,
      uploadedAt: true,
      netAmount: true,
      employeeName: true,
    },
  });

  const banks = Array.from(new Set(allPayslips.map((p) => p.bankName).filter((bank): bank is string => !!bank))).sort();
  const payslips = selectedBank ? allPayslips.filter((p) => p.bankName === selectedBank) : allPayslips;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {payslips.length} recibo{payslips.length !== 1 ? "s" : ""} cargado{payslips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {banks.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/payslips"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!selectedBank ? "bg-indigo-100 text-indigo-700" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
          >
            Todos
          </Link>
          {banks.map((bank) => (
            <Link
              key={bank}
              href={`/payslips?bank=${encodeURIComponent(bank)}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedBank === bank ? "bg-indigo-100 text-indigo-700" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
            >
              {bank}
            </Link>
          ))}
        </div>
      )}

      {payslips.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-600">No hay recibos cargados</p>
          <p className="mt-1 text-xs text-zinc-400">
            Subí tu primer PDF desde la sección de recibos de sueldo.
          </p>
          <OpenUploadButton
            kind="payslip"
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Cargar recibo
          </OpenUploadButton>
        </Card>
      ) : (
        <div className="space-y-2">
          {payslips.map((payslip) => (
            <Link key={payslip.id} href={`/payslips/${payslip.id}`}>
              <Card className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-all hover:border-indigo-200 hover:shadow-md">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Recibo PDF
                    </span>
                    {payslip.bankName && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                        {payslip.bankName}
                      </span>
                    )}
                    {payslip.processingStatus === "QUEUED" && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                        AI · en cola
                      </span>
                    )}
                    {payslip.processingStatus === "ANALYZING" && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        AI · analizando
                      </span>
                    )}
                    {payslip.processingStatus === "REVIEW_REQUIRED" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        AI · revisar
                      </span>
                    )}
                    {payslip.processingStatus === "FAILED" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        AI · error
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-zinc-800">
                      {payslip.employerName ?? payslip.rawFilename}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                    {payslip.periodLabel && <span>Período: {payslip.periodLabel}</span>}
                    {payslip.payDate && <span>Pago: {formatDate(payslip.payDate)}</span>}
                    <span>Subido: {new Date(payslip.uploadedAt).toLocaleString("es-AR")}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-semibold text-zinc-900 tabular-nums">
                    {payslip.netAmount != null ? formatARS(toMoneyNumber(payslip.netAmount)) : "—"}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {payslip.employeeName ?? "Ingreso detectado"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-zinc-300" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
