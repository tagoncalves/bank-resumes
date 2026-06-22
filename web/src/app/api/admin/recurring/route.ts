import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { money, toMoneyNumber, toNullableMoneyNumber, type MoneyValue } from "@/lib/money";
import { parseDateOnly } from "@/lib/dates";
import { normalizeFrequency, normalizeInterval } from "@/lib/recurring/schedule";

function serializeRecurring(item: {
  amountArs: MoneyValue;
  amountUsd: MoneyValue;
  [key: string]: unknown;
}) {
  return {
    ...item,
    amountArs: toMoneyNumber(item.amountArs),
    amountUsd: toNullableMoneyNumber(item.amountUsd),
  };
}

export async function GET() {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const items = await prisma.recurringTransaction.findMany({
    include: { category: true, user: { select: { id: true, username: true, displayName: true } } },
    orderBy: { nextRunAt: "asc" },
  });
  return NextResponse.json(items.map(serializeRecurring));
}

export async function POST(request: Request) {
  const { session, deny } = await requireAdmin();
  if (deny) return deny;

  const body = await request.json();
  if (!body.merchantName || body.amountArs == null || !body.nextRunAt) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  const frequency = normalizeFrequency(body.frequency);
  const interval = normalizeInterval(body.interval);
  const anchorDate = parseDateOnly(body.nextRunAt);

  const created = await prisma.recurringTransaction.create({
    data: {
      userId: body.userId ?? session.userId,
      merchantName: String(body.merchantName).trim(),
      amountArs: money(Number(body.amountArs)),
      amountUsd: body.amountUsd == null ? null : money(Number(body.amountUsd)),
      currency: body.currency ?? "ARS",
      transactionType: body.transactionType ?? "DEBIT",
      categoryId: body.categoryId || null,
      frequency,
      interval,
      anchorDate,
      dayOfMonth: anchorDate.getUTCDate(),
      nextRunAt: anchorDate,
      requiresConfirmation: body.requiresConfirmation ?? true,
      reminderDaysBefore: Number(body.reminderDaysBefore ?? 3),
      notes: body.notes || null,
    },
    include: { category: true, user: { select: { id: true, username: true, displayName: true } } },
  });

  return NextResponse.json(serializeRecurring(created), { status: 201 });
}
