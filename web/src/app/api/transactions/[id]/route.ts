import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { optionalMoneyInput, requireMoneyInput, toMoneyNumber, toNullableMoneyNumber } from "@/lib/money";
import { parseDateOnly } from "@/lib/dates";
import { inferTransactionClassification, type TransactionNature, type TransactionReviewStatus } from "@/lib/transactions/classification";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const existing = await prisma.transaction.findUnique({
    where: { id },
    select: {
      userId: true,
      source: true,
      statementId: true,
      transactionType: true,
      merchantName: true,
      normalizedMerchant: true,
      isInstallment: true,
      isSubscription: true,
      isReversal: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const body = await req.json();
  const {
    categoryId,
    date,
    merchantName,
    amountArs,
    amountUsd,
    transactionType,
    isInstallment,
    installmentCurrent,
    installmentTotal,
    isSubscription,
    nature,
    reviewStatus,
    spendingImpact,
    cashflowImpact,
  } = body as {
    categoryId?: string | null;
    date?: string;
    merchantName?: string;
    amountArs?: number;
    amountUsd?: number | null;
    transactionType?: string;
    isInstallment?: boolean;
    installmentCurrent?: number | null;
    installmentTotal?: number | null;
    isSubscription?: boolean;
    nature?: TransactionNature;
    reviewStatus?: TransactionReviewStatus;
    spendingImpact?: boolean;
    cashflowImpact?: boolean;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (categoryId !== undefined) data.categoryId = categoryId;
  if (date !== undefined) data.date = parseDateOnly(date);
  if (merchantName !== undefined) {
    data.merchantName = merchantName.trim();
    data.normalizedMerchant = merchantName.trim().replace(/\s+/g, " ");
  }
  try {
    if (amountArs !== undefined) data.amountArs = requireMoneyInput(amountArs, "amountArs");
    if (amountUsd !== undefined) data.amountUsd = optionalMoneyInput(amountUsd, "amountUsd");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Importe inválido" },
      { status: 400 }
    );
  }
  if (transactionType !== undefined) data.transactionType = transactionType;
  if (isInstallment !== undefined) data.isInstallment = isInstallment;
  if (installmentCurrent !== undefined) data.installmentCurrent = installmentCurrent;
  if (installmentTotal !== undefined) data.installmentTotal = installmentTotal;
  if (isSubscription !== undefined) data.isSubscription = isSubscription;
  if (nature !== undefined) data.nature = nature;
  if (reviewStatus !== undefined) data.reviewStatus = reviewStatus;
  if (spendingImpact !== undefined) data.spendingImpact = spendingImpact;
  if (cashflowImpact !== undefined) data.cashflowImpact = cashflowImpact;

  if (nature === undefined && (transactionType !== undefined || merchantName !== undefined || isInstallment !== undefined || isSubscription !== undefined)) {
    const classification = inferTransactionClassification({
      transactionType: transactionType ?? existing.transactionType,
      source: existing.source,
      statementId: existing.statementId,
      merchantName: merchantName ?? existing.merchantName,
      normalizedMerchant: merchantName ? merchantName.trim().replace(/\s+/g, " ") : existing.normalizedMerchant,
      isInstallment: isInstallment ?? existing.isInstallment,
      isSubscription: isSubscription ?? existing.isSubscription,
      isReversal: existing.isReversal,
    });
    data.nature = classification.nature;
    data.reviewStatus = classification.reviewStatus;
    data.spendingImpact = classification.spendingImpact;
    data.cashflowImpact = classification.cashflowImpact;
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data,
    include: { category: true },
  });

  return NextResponse.json({
    ...updated,
    amountArs: toMoneyNumber(updated.amountArs),
    amountUsd: toNullableMoneyNumber(updated.amountUsd),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const existing = await prisma.transaction.findUnique({
    where: { id },
    select: { userId: true, merchantName: true, amountArs: true, transactionType: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  await prisma.$transaction(async (db) => {
    await db.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await db.recurringTransaction.updateMany({
      where: {
        userId: session.userId,
        enabled: true,
        occurrences: {
          some: { transactionId: id },
          none: { transaction: { deletedAt: null } },
        },
      },
      data: { enabled: false },
    });

    const remainingBackers = await db.transaction.count({
      where: {
        userId: session.userId,
        deletedAt: null,
        merchantName: existing.merchantName,
        amountArs: existing.amountArs,
        transactionType: existing.transactionType,
      },
    });

    if (remainingBackers === 0) {
      await db.recurringTransaction.updateMany({
        where: {
          userId: session.userId,
          enabled: true,
          merchantName: existing.merchantName,
          amountArs: existing.amountArs,
          transactionType: existing.transactionType,
          occurrences: { none: {} },
        },
        data: { enabled: false },
      });
    }
  });
  return NextResponse.json({ ok: true });
}
