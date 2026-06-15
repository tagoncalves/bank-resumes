import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toMoneyNumber } from "@/lib/money";

export async function GET() {
  const session = await getSession();
  const payslips = await prisma.payslip.findMany({
    where: { userId: session?.userId ?? null },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json(
    payslips.map((payslip) => ({
      id: payslip.id,
      rawFilename: payslip.rawFilename,
      bankName: payslip.bankName,
      employerName: payslip.employerName,
      employeeName: payslip.employeeName,
      periodLabel: payslip.periodLabel,
      payDate: payslip.payDate,
      netAmount: toMoneyNumber(payslip.netAmount),
      processingStatus: payslip.processingStatus,
      uploadedAt: payslip.uploadedAt,
    }))
  );
}
