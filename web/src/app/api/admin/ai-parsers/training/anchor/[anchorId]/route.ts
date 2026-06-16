import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ anchorId: string }> },
) {
  const auth = await requireAdmin()
  if (auth.deny) return auth.deny

  try {
    const { anchorId } = await params

    const existing = await prisma.parserTrainingAnchor.findUnique({
      where: { id: anchorId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Ancla no encontrada" }, { status: 404 })
    }

    await prisma.parserTrainingAnchor.delete({
      where: { id: anchorId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al eliminar ancla"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
