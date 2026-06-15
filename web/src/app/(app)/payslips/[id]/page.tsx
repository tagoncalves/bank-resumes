import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatARS, formatDate } from "@/lib/formatters";
import { toMoneyNumber } from "@/lib/money";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { DeletePayslipButton } from "@/components/ui/delete-payslip-button";

export default async function PayslipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const payslip = await prisma.payslip.findFirst({
    where: {
      id,
      userId: session?.userId ?? null,
    },
    include: {
      incomeTransaction: {
        include: {
          category: true,
        },
      },
    },
  });

  if (!payslip) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/payslips"
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" /> Recibos
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/payslips/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <FileText className="h-4 w-4" /> Ver PDF
          </a>
          <a
            href={`/api/payslips/${id}/pdf/download`}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <Download className="h-4 w-4" /> Descargar PDF
          </a>
          <DeletePayslipButton id={id} />
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-zinc-900">
                {payslip.employerName ?? payslip.rawFilename}
              </p>
              <p className="text-sm text-zinc-500">{payslip.employeeName ?? "Empleado no detectado"}</p>
              <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                {payslip.periodLabel && <span>Período: {payslip.periodLabel}</span>}
                {payslip.payDate && <span>Pago: {formatDate(payslip.payDate)}</span>}
                <span>{describePayslipStatus(payslip.analysisProvider, payslip.processingStatus)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold font-mono text-emerald-600 tabular-nums">
                {payslip.netAmount != null ? `+${formatARS(toMoneyNumber(payslip.netAmount))}` : "—"}
              </p>
              {payslip.grossAmount ? (
                <p className="text-sm font-mono text-zinc-500">Bruto: {formatARS(toMoneyNumber(payslip.grossAmount))}</p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-400">
                Subido: {new Date(payslip.uploadedAt).toLocaleString("es-AR")}
              </p>
            </div>
          </div>
          {payslip.analysisNotes && (
            <div className={`mt-4 rounded-md px-4 py-3 text-xs ${["REVIEW_REQUIRED", "PRELIMINARY"].includes(payslip.processingStatus) ? "bg-amber-50 text-amber-800" : "bg-violet-50 text-violet-800"}`}>
              <p className="font-medium">
                Análisis AI
                {typeof payslip.analysisConfidence === "number" ? ` · confianza ${(payslip.analysisConfidence * 100).toFixed(0)}%` : ""}
              </p>
              <p className="mt-1 whitespace-pre-line">{payslip.analysisNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">Detalle del ingreso generado</CardTitle>
        </CardHeader>
        <CardContent>
          {payslip.incomeTransaction ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <DetailItem label="Fecha" value={formatDate(payslip.incomeTransaction.date)} />
              <DetailItem label="Descripción" value={payslip.incomeTransaction.normalizedMerchant || payslip.incomeTransaction.merchantName} />
              <DetailItem label="Categoría" value={payslip.incomeTransaction.category?.name ?? "Sin categoría"} />
              <DetailItem label="Importe" value={`+${formatARS(toMoneyNumber(payslip.incomeTransaction.amountArs))}`} valueClass="font-mono text-emerald-600" />
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Todavía no hay un movimiento asociado a este recibo.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">Archivo importado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <DetailItem label="Archivo" value={payslip.rawFilename} />
            <DetailItem label="Origen" value={payslip.analysisProvider ? "AI" : "Mapeo automático"} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function describePayslipStatus(provider: string | null, status: string) {
  if (!provider) return "Importado con mapeo automático";
  if (status === "QUEUED") return "Pendiente de análisis AI";
  if (status === "ANALYZING") return "Analizando con AI";
  if (status === "PRELIMINARY") return "Importado con AI · pendiente de confirmación";
  if (status === "REVIEW_REQUIRED") return "Importado con AI · revisar";
  if (status === "FAILED") return "Análisis AI con error";
  return "Importado con AI";
}

function DetailItem({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={valueClass ?? "text-zinc-800"}>{value}</p>
    </div>
  );
}
