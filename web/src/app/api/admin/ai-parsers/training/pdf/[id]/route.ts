import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { getPayslipContentType, readPayslipPdf, readPendingPayslipPdf } from "@/lib/statement-pdf"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.deny) return auth.deny

  try {
    const { id } = await params
    const payslip = await prisma.payslip.findUnique({ where: { id }, select: { rawFilename: true, storedFilename: true } })
    if (!payslip) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 })
    }
    let buffer: Buffer

    try {
      buffer = readPayslipPdf(id, payslip.rawFilename, payslip.storedFilename)
    } catch {
      try {
        buffer = readPendingPayslipPdf(id, payslip.rawFilename, payslip.storedFilename)
      } catch {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 })
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": getPayslipContentType(payslip.rawFilename),
        "Content-Disposition": `inline; filename="${payslip.rawFilename}"`,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al servir PDF"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
