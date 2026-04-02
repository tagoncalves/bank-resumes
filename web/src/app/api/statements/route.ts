import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const bankName = searchParams.get("bankName");

  const where = bankName ? { bankName } : {};

  const [total, statements] = await Promise.all([
    prisma.statement.count({ where }),
    prisma.statement.findMany({
      where,
      orderBy: { periodEnd: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        balanceSummary: true,
        card: true,
        _count: { select: { transactions: true } },
      },
    }),
  ]);

  const data = statements.map((s) => ({
    id: s.id,
    bankName: s.bankName,
    cardLastFour: s.card.lastFour,
    holderName: s.card.holderName,
    cardNetwork: s.card.cardNetwork,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    dueDate: s.dueDate,
    currentBalance: s.balanceSummary?.currentBalance ?? 0,
    currentBalanceUsd: s.balanceSummary?.currentBalanceUsd ?? null,
    minimumPayment: s.balanceSummary?.minimumPayment ?? 0,
    transactionCount: s._count.transactions,
    uploadedAt: s.uploadedAt,
  }));

  return NextResponse.json({ data, total, page, pageSize: limit });
}
