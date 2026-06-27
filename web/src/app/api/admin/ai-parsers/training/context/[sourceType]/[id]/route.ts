import { NextRequest, NextResponse } from "next/server"
import { loadImage } from "canvas"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { extractPdfPageDimensions } from "@/lib/parser-training/pdf-words"
import { isPdfFilename, readTrainingSourcePdf } from "@/lib/parser-training/source-pdf"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceType: string; id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.deny) return auth.deny

  try {
    const { sourceType, id } = await params
    if (sourceType === "PAYSLIP") {
      const payslip = await prisma.payslip.findUnique({
        where: { id },
        include: {
          aiParsers: {
            where: { status: "APPROVED" },
            take: 1,
          },
          parserTrainingAnchors: {
            orderBy: { createdAt: "asc" },
          },
        },
      })

      if (!payslip) {
        return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 })
      }

      const sourceBuffer = readTrainingSourcePdf(sourceType, id, payslip.rawFilename, payslip.storedFilename)
      const pages = isPdfFilename(payslip.rawFilename)
        ? await extractPdfPageDimensions(sourceBuffer)
        : await (async () => {
            const image = await loadImage(sourceBuffer)
            return [{ pageNumber: 1, width: image.width, height: image.height }]
          })()

      return NextResponse.json({
        sourceType: "PAYSLIP",
        id: payslip.id,
        rawFilename: payslip.rawFilename,
        processingStatus: payslip.processingStatus,
        employerName: payslip.employerName,
        employeeName: payslip.employeeName,
        periodLabel: payslip.periodLabel,
        payDate: payslip.payDate,
        netAmount: payslip.netAmount,
        grossAmount: payslip.grossAmount,
        anchors: payslip.parserTrainingAnchors,
        approvedParser: payslip.aiParsers[0] ?? null,
        pages,
      })
    }

    if (sourceType === "STATEMENT") {
      const statement = await prisma.statement.findUnique({
        where: { id },
        include: {
          parserTrainingAnchors: {
            orderBy: { createdAt: "asc" },
          },
        },
      })

      if (!statement) {
        return NextResponse.json({ error: "Estado de cuenta no encontrado" }, { status: 404 })
      }

      const sourceBuffer = readTrainingSourcePdf(sourceType, id, statement.rawFilename, statement.storedFilename)
      const pages = await extractPdfPageDimensions(sourceBuffer)

      return NextResponse.json({
        sourceType: "STATEMENT",
        id: statement.id,
        rawFilename: statement.rawFilename,
        processingStatus: statement.processingStatus,
        bankName: statement.bankName,
        anchors: statement.parserTrainingAnchors,
        pages,
      })
    }

    return NextResponse.json({ error: "Tipo de fuente inválido" }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener contexto de entrenamiento"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
