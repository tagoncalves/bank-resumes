import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { toMoneyNumber } from "@/lib/money";

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return session;
}

export async function GET() {
  const session = await guardAdmin();
  if (session instanceof NextResponse) return session;

  const payslips = await prisma.payslip.findMany({
    orderBy: [{ processingStatus: "asc" }, { uploadedAt: "desc" }],
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
  });

  return NextResponse.json(
    payslips.map((p) => ({
      id: p.id,
      userId: p.userId,
      rawFilename: p.rawFilename,
      bankName: p.bankName,
      employerName: p.employerName,
      employeeName: p.employeeName,
      periodLabel: p.periodLabel,
      payDate: p.payDate,
      netAmount: toMoneyNumber(p.netAmount),
      processingStatus: p.processingStatus,
      analysisProvider: p.analysisProvider,
      analysisModel: p.analysisModel,
      analysisConfidence: p.analysisConfidence,
      analysisNotes: p.analysisNotes,
      uploadedAt: p.uploadedAt,
      user: p.user
        ? { username: p.user.username, displayName: p.user.displayName }
        : null,
    }))
  );
}
