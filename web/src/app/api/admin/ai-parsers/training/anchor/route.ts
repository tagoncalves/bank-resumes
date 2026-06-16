import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.deny) return auth.deny

  try {
    const body = await request.json()
    const {
      id,
      sourceType,
      sourceId,
      fieldName,
      pageNumber,
      x0,
      top,
      x1,
      bottom,
      mode,
      rawText,
      confirmedText,
      labelText,
    } = body

    if (!sourceType || !sourceId || !fieldName || pageNumber == null || x0 == null || top == null || x1 == null || bottom == null) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const anchorData: Record<string, unknown> = {
      sourceType,
      fieldName,
      pageNumber: Number(pageNumber),
      x0: Number(x0),
      top: Number(top),
      x1: Number(x1),
      bottom: Number(bottom),
      mode: mode || "region_exact",
      rawText: rawText ?? null,
      confirmedText: confirmedText ?? null,
      labelText: labelText ?? null,
      trainedById: auth.session.userId,
    }

    if (sourceType === "PAYSLIP") {
      anchorData.payslipId = sourceId
    } else if (sourceType === "STATEMENT") {
      anchorData.statementId = sourceId
    } else {
      return NextResponse.json({ error: "Tipo de fuente inválido" }, { status: 400 })
    }

    let anchor
    if (id) {
      anchor = await prisma.parserTrainingAnchor.update({
        where: { id },
        data: anchorData as any,
      })
    } else {
      anchor = await prisma.parserTrainingAnchor.create({
        data: anchorData as any,
      })
    }

    return NextResponse.json(anchor)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al guardar ancla"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.deny) return auth.deny

  try {
    const { searchParams } = new URL(request.url)
    const sourceType = searchParams.get("sourceType")
    const sourceId = searchParams.get("sourceId")

    if (!sourceType || !sourceId) {
      return NextResponse.json({ error: "sourceType y sourceId son requeridos" }, { status: 400 })
    }

    const anchors = await prisma.parserTrainingAnchor.findMany({
      where: {
        sourceType,
        ...(sourceType === "PAYSLIP" ? { payslipId: sourceId } : { statementId: sourceId }),
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(anchors)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al listar anclas"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
