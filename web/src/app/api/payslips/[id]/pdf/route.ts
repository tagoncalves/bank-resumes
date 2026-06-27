import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildDownloadFilename, getPayslipContentType, getPayslipFileExtension, readPayslipPdf } from "@/lib/statement-pdf";

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
    select: {
      id: true,
      rawFilename: true,
      storedFilename: true,
      userId: true,
      bankName: true,
      employerName: true,
      payDate: true,
      periodLabel: true,
      user: { select: { username: true, displayName: true } },
    },
  });

  if (!payslip) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (payslip.userId !== session.userId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  try {
    const buffer = readPayslipPdf(id, payslip.rawFilename, payslip.storedFilename);
    const filename = buildDownloadFilename({
      bankName: payslip.bankName ?? payslip.employerName,
      type: "recibo",
      period: payslip.payDate ?? payslip.periodLabel,
      username: payslip.user?.displayName ?? payslip.user?.username ?? session.username,
      extension: getPayslipFileExtension(payslip.rawFilename, payslip.storedFilename),
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": getPayslipContentType(payslip.rawFilename),
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
  }
}
