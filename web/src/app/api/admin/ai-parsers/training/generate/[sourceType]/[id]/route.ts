import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { extractWordsFromPdf } from "@/lib/parser-training/pdf-words"
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
      return NextResponse.json({ error: "No hay anclas entrenadas para generar un parser" }, { status: 400 })
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

    const extraction = sourceRecord.rawFilename.toLowerCase().endsWith(".pdf") ? await extractWordsFromPdf(pdfBuffer) : { pages: [] }

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

    const parserCode = generateParserCode(trainingAnchors)

    return NextResponse.json({
      generatedParserCode: parserCode,
      testResult: result,
      pages: extraction.pages,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al generar parser"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function generateParserCode(anchors: TrainingAnchor[]): string {
  const anchorDefs = anchors.map(
    (a) => `  { fieldName: "${a.fieldName}", pageNumber: ${a.pageNumber}, x0: ${a.x0}, top: ${a.top}, x1: ${a.x1}, bottom: ${a.bottom}, mode: "${a.mode}", labelText: ${a.labelText ? `"${a.labelText}"` : null} }`,
  )

  return `// Generated deterministic parser from ${anchors.length} anchor(s)
// Source: manual parser training

const anchors = [
${anchorDefs.join(",\n")}
]

function extractField(words, anchor) {
  if (anchor.mode === "region_exact") {
    return words
      .filter(w => w.pageNumber === anchor.pageNumber
        && w.x >= anchor.x0 && w.x + w.width <= anchor.x1
        && w.y >= anchor.bottom && w.y <= anchor.top)
      .sort((a, b) => { const r = b.y - a.y; return Math.abs(r) > 5 ? r : a.x - b.x })
      .map(w => w.text).join(" ")
  }
  if (anchor.mode === "right_of_label") {
    const rightEdge = Math.max(
      ...words.filter(w => w.pageNumber === anchor.pageNumber
        && w.x >= anchor.x0 && w.x + w.width <= anchor.x1
        && w.y >= anchor.bottom - 5 && w.y <= anchor.top + 5)
        .map(w => w.x + w.width)
    )
    if (rightEdge === -Infinity) return null
    const minY = anchor.bottom - 5
    const maxY = anchor.top + 5
    return words
      .filter(w => w.pageNumber === anchor.pageNumber && w.x >= rightEdge && w.y >= minY && w.y <= maxY)
      .sort((a, b) => { const r = b.y - a.y; return Math.abs(r) > 5 ? r : a.x - b.x })
      .map(w => w.text).join(" ")
  }
  return null
}

export function parse(pdfWords) {
  const fields = {}
  for (const anchor of anchors) {
    fields[anchor.fieldName] = extractField(pdfWords, anchor)
  }
  return fields
}`
}
