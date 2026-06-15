import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deleteAiParsersForSource } from "@/lib/ai/parser-generator";

const PAYSLIP_DIR = path.join(process.cwd(), "uploads", "payslips");
const PENDING_DIR = path.join(PAYSLIP_DIR, "pending");

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const payslip = await prisma.payslip.findUnique({
    where: { id },
    select: { userId: true, incomeTransactionId: true },
  });
  if (!payslip) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (payslip.userId !== session.userId) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  // Clean up old AI parsers
  await deleteAiParsersForSource("PAYSLIP", id);

  await prisma.$transaction([
    ...(payslip.incomeTransactionId
      ? [prisma.transaction.delete({ where: { id: payslip.incomeTransactionId } })]
      : []),
    prisma.payslip.delete({ where: { id } }),
  ]);

  for (const dir of [PAYSLIP_DIR, PENDING_DIR]) {
    const filePath = path.join(dir, `${id}.pdf`);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  }

  return NextResponse.json({ ok: true });
}
