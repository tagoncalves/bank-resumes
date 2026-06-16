import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { type TrainingAnchor } from "@/lib/parser-training/deterministic-parser"
import { runDeterministicParserForPdf } from "@/lib/parser-training/region-extractor"
import { readPayslipPdf, readPendingPayslipPdf } from "@/lib/statement-pdf"
import { money } from "@/lib/money"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceType: string; id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.deny) return auth.deny

  try {
    const { sourceType, id } = await params

    if (sourceType !== "PAYSLIP") {
      return NextResponse.json({ error: "Solo soportamos PAYSLIP por ahora" }, { status: 400 })
    }

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        parserTrainingAnchors: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!payslip) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 })
    }

    const anchors = payslip.parserTrainingAnchors
    if (anchors.length === 0) {
      return NextResponse.json({ error: "No hay anclas entrenadas" }, { status: 400 })
    }

    let pdfBuffer: Buffer
    try {
      pdfBuffer = readPayslipPdf(id, payslip.rawFilename)
    } catch {
      try {
        pdfBuffer = readPendingPayslipPdf(id, payslip.rawFilename)
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

    const result = await runDeterministicParserForPdf(pdfBuffer, trainingAnchors, payslip.rawFilename)

    if (!result.allPassed) {
      return NextResponse.json({
        error: "El parser no pasa todas las validaciones. Revisá los resultados de la prueba antes de aprobar.",
        testResult: result,
      }, { status: 400 })
    }

    const parserCode = JSON.stringify({
      type: "deterministic",
      anchors: anchors.map((a) => ({
        fieldName: a.fieldName,
        pageNumber: a.pageNumber,
        x0: a.x0,
        top: a.top,
        x1: a.x1,
        bottom: a.bottom,
        mode: a.mode,
        labelText: a.labelText,
        confirmedText: a.confirmedText,
      })),
    })

    const existingParser = await prisma.aiParser.findFirst({
      where: {
        payslipId: id,
        sourceType: "PAYSLIP",
      },
    })

    let aiParser
    if (existingParser) {
      aiParser = await prisma.aiParser.update({
        where: { id: existingParser.id },
        data: {
          parserCode,
          filePath: `training:${id}`,
          formatSignature: `manual-training-${id}`,
          bankName: payslip.bankName,
          employerName: payslip.employerName,
          status: "APPROVED",
          reviewedById: auth.session.userId,
          reviewedAt: new Date(),
        },
      })
    } else {
      aiParser = await prisma.aiParser.create({
        data: {
          payslipId: id,
          parserCode,
          filePath: `training:${id}`,
          formatSignature: `manual-training-${id}`,
          sourceType: "PAYSLIP",
          bankName: payslip.bankName,
          employerName: payslip.employerName,
          status: "APPROVED",
          reviewedById: auth.session.userId,
          reviewedAt: new Date(),
        },
      })
    }

    await prisma.parserTrainingAnchor.updateMany({
      where: { payslipId: id },
      data: { aiParserId: aiParser.id },
    })

    const extractedFields = result.fields

    await prisma.payslip.update({
      where: { id },
      data: {
        employerName: extractedFields.employer_name ?? payslip.employerName,
        employeeName: extractedFields.employee_name ?? payslip.employeeName,
        periodLabel: extractedFields.period_label ?? payslip.periodLabel,
        payDate: extractedFields.pay_date ? new Date(extractedFields.pay_date) : payslip.payDate,
        netAmount: extractedFields.net_amount_ars ? money(parseDecimal(extractedFields.net_amount_ars)) : payslip.netAmount,
        grossAmount: extractedFields.gross_amount_ars ? money(parseDecimal(extractedFields.gross_amount_ars)) : payslip.grossAmount,
        processingStatus: "PRELIMINARY",
        analysisProvider: "MANUAL_TRAINING",
        analysisNotes: "Procesado con parser entrenado manualmente",
        analysisStructuredJson: JSON.stringify(extractedFields),
      },
    })

    return NextResponse.json({
      success: true,
      aiParserId: aiParser.id,
      extractedFields,
      testResult: result,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al aprobar parser"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function parseDecimal(val: string): number {
  const cleaned = val.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".")
  return parseFloat(cleaned)
}
