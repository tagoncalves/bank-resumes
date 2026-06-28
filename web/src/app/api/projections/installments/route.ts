import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toMoneyNumber } from "@/lib/money";

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const groups = await prisma.transaction.groupBy({
    by: ["merchantName", "amountArs", "amountUsd", "cardLastFour"],
    where: {
      userId: session.userId,
      isInstallment: true,
      deletedAt: null,
      installmentTotal: { not: null },
    },
    _max: { installmentCurrent: true, date: true },
    _min: { installmentTotal: true },
    orderBy: { _max: { date: "desc" } },
  });

  const now = new Date();
  const rows: Array<{
    merchantName: string;
    amountArs: number;
    amountUsd: number | null;
    cardLastFour: string | null;
    totalInstallments: number;
    currentInstallment: number;
    remaining: number;
    lastDate: string;
    nextInstallmentDate: string;
    estimatedEndDate: string;
  }> = [];

  for (const g of groups) {
    const total = g._min.installmentTotal ?? 0;
    const current = g._max.installmentCurrent ?? 0;
    if (current >= total) continue;
    const remaining = total - current;
    const lastDate = g._max.date ?? now;
    const nextDate = addMonths(lastDate, 1);
    const endDate = addMonths(lastDate, remaining);

    rows.push({
      merchantName: g.merchantName,
      amountArs: toMoneyNumber(g.amountArs),
      amountUsd: g.amountUsd ? toMoneyNumber(g.amountUsd) : null,
      cardLastFour: g.cardLastFour,
      totalInstallments: total,
      currentInstallment: current,
      remaining,
      lastDate: lastDate.toISOString().slice(0, 10),
      nextInstallmentDate: nextDate.toISOString().slice(0, 10),
      estimatedEndDate: endDate.toISOString().slice(0, 10),
    });
  }

  return NextResponse.json({
    data: rows,
    totalRemaining: rows.reduce((s, r) => s + r.remaining, 0),
    totalAmountArs: rows.reduce((s, r) => s + r.amountArs * r.remaining, 0),
  });
}
