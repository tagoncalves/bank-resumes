import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toMoneyNumber } from "@/lib/money";

function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

export async function GET() {
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
  const firstProjectionMonth = addMonths(now, 1);
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
    const futureDates = Array.from({ length: remaining }, (_, index) => addMonths(lastDate, index + 1))
      .filter((date) => date >= firstProjectionMonth);
    if (futureDates.length === 0) continue;
    const nextDate = futureDates[0];
    const endDate = futureDates[futureDates.length - 1];

    rows.push({
      merchantName: g.merchantName,
      amountArs: toMoneyNumber(g.amountArs),
      amountUsd: g.amountUsd ? toMoneyNumber(g.amountUsd) : null,
      cardLastFour: g.cardLastFour,
      totalInstallments: total,
      currentInstallment: current,
      remaining: futureDates.length,
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
