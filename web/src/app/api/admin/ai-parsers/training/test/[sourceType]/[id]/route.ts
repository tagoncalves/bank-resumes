import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { type TrainingAnchor } from "@/lib/parser-training/deterministic-parser"
import { runDeterministicParserForPdf } from "@/lib/parser-training/region-extractor"
import { readPayslipPdf, readPendingPayslipPdf } from "@/lib/statement-pdf"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceType: string; id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.deny) return auth.deny

  try {
    const { sourceType, id } = await params
    const sourceRecord = sourceType === "PAYSLIP"
      ? await prisma.payslip.findUnique({ where: { id }, select: { rawFilename: true } })
      : await prisma.statement.findUnique({ where: { id }, select: { rawFilename: true } })

    if (!sourceRecord) {
      return NextResponse.json({ error: "Archivo fuente no encontrado" }, { status: 404 })
    }

    const anchors = await prisma.parserTrainingAnchor.findMany({
      where: {
        sourceType,
        ...(sourceType === "PAYSLIP" ? { payslipId: id } : { statementId: id }),
      },
      orderBy: { createdAt: "asc" },
    })

    if (anchors.length === 0) {
      return NextResponse.json({ error: "No hay anclas entrenadas para probar" }, { status: 400 })
    }

    let pdfBuffer: Buffer
    try {
      pdfBuffer = readPayslipPdf(id, sourceRecord.rawFilename)
    } catch {
      try {
        pdfBuffer = readPendingPayslipPdf(id, sourceRecord.rawFilename)
      } catch {
        return NextResponse.json({ error: "PDF no encontrado" }, { status: 404 })
      }
    }

    const trainingAnchors: TrainingAnchor[] = anchors.map((a) => ({
      id: a.id,
      fieldName: a.fieldName,
      pageNumber: a.pageNumber,
      x0: a.x0,
      top: a.top,
      x1: a.x1,
      bottom: a.bottom,
      mode: a.mode,
      rawText: a.rawText,
      confirmedText: a.confirmedText,
      labelText: a.labelText,
    }))

    const result = await runDeterministicParserForPdf(pdfBuffer, trainingAnchors, sourceRecord.rawFilename)

    return NextResponse.json({
      testResult: result,
      allPassed: result.allPassed,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al probar parser"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
