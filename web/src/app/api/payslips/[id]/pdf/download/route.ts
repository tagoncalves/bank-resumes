import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { readPayslipPdf } from "@/lib/statement-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const payslip = await prisma.payslip.findUnique({
    where: { id },
    select: { rawFilename: true, userId: true },
  });

  if (!payslip) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (payslip.userId !== session.userId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  try {
    const buffer = readPayslipPdf(id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${payslip.rawFilename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });
  }
}
