import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { toMoneyNumber, toNullableMoneyNumber } from "@/lib/money";
import { createManualTransactionForUser } from "@/lib/transactions/create-transaction";
import { parseDateOnly, parseDateRangeEnd, parseDateRangeStart } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const search = searchParams.get("search");
  const categoryId = searchParams.get("categoryId");
  const origin = searchParams.get("origin");
  const type = searchParams.get("type");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const bankName = searchParams.get("bankName");
  const currency = searchParams.get("currency");
  const amountMin = searchParams.get("amountMin");
  const amountMax = searchParams.get("amountMax");

  const sortBy = searchParams.get("sortBy") ?? "date";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  const SORT_FIELDS: Record<string, Prisma.TransactionOrderByWithRelationInput> = {
    date: { date: sortOrder },
    merchantName: { normalizedMerchant: sortOrder },
    amountArs: { amountArs: sortOrder },
    category: { category: { name: sortOrder } },
  };
  const orderBy = SORT_FIELDS[sortBy] ?? { date: sortOrder };

  const where: Prisma.TransactionWhereInput = {
    deletedAt: null,
    userId: session.userId,
  };

  const andClauses: Prisma.TransactionWhereInput[] = [];

  if (search?.trim()) {
    const term = search.trim();
    andClauses.push({
      OR: [
        { merchantName: { contains: term } },
        { normalizedMerchant: { contains: term } },
        { cardLastFour: { contains: term } },
        { statement: { bankName: { contains: term } } },
        { category: { name: { contains: term } } },
        { payslip: { employerName: { contains: term } } },
        { payslip: { periodLabel: { contains: term } } },
      ],
    });
  }
  if (categoryId) {
    const ids = categoryId.split(",").filter(Boolean);
    where.categoryId = ids.length === 1 ? ids[0] : { in: ids };
  }
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Prisma.DateTimeFilter).gte = parseDateRangeStart(dateFrom);
    if (dateTo) (where.date as Prisma.DateTimeFilter).lte = parseDateRangeEnd(dateTo);
  }
  if (bankName) {
    where.statement = { bankName };
  }
  if (origin) {
    const origins = origin.split(",").filter(Boolean);
    const originClauses: Prisma.TransactionWhereInput[] = [];
    if (origins.includes("manual")) originClauses.push({ source: "MANUAL" });
    if (origins.includes("statement")) originClauses.push({ statementId: { not: null } });
    if (origins.includes("payslip")) originClauses.push({ payslip: { isNot: null } });
    if (originClauses.length) {
      andClauses.push({ OR: originClauses });
    }
  }
  if (type) {
    const types = type.split(",").filter(Boolean);
    if (types.length === 1) {
      where.transactionType = types[0];
    } else if (types.length > 1) {
      where.transactionType = { in: types };
    }
  }
  if (currency === "USD") {
    where.amountUsd = { not: null };
  } else if (currency === "ARS") {
    where.amountArs = { gt: 0 };
  }

  const parsedAmountMin = amountMin ? Number(amountMin) : NaN;
  const parsedAmountMax = amountMax ? Number(amountMax) : NaN;
  if (!Number.isNaN(parsedAmountMin) || !Number.isNaN(parsedAmountMax)) {
    const amountFilter: Prisma.DecimalFilter = {};
    if (!Number.isNaN(parsedAmountMin)) amountFilter.gte = parsedAmountMin;
    if (!Number.isNaN(parsedAmountMax)) amountFilter.lte = parsedAmountMax;
    if (currency === "USD") where.amountUsd = { ...((where.amountUsd as Prisma.DecimalNullableFilter) ?? {}), ...amountFilter };
    else where.amountArs = { ...((where.amountArs as Prisma.DecimalFilter) ?? {}), ...amountFilter };
  }

  if (andClauses.length) where.AND = andClauses;

  const [total, transactions, debitSum, creditSum] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: true,
        statement: { select: { bankName: true, periodEnd: true } },
        payslip: { select: { employerName: true, periodLabel: true } },
      },
    }),
    prisma.transaction.aggregate({
      where: { ...where, transactionType: "DEBIT" },
      _sum: { amountArs: true, amountUsd: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, transactionType: "CREDIT" },
      _sum: { amountArs: true, amountUsd: true },
    }),
  ]);

  const data = transactions.map((transaction) => ({
    ...transaction,
    amountArs: toMoneyNumber(transaction.amountArs),
    amountUsd: toNullableMoneyNumber(transaction.amountUsd),
  }));

  return NextResponse.json({
    data,
    total,
    page,
    pageSize: limit,
    debitTotal: toMoneyNumber(debitSum._sum.amountArs),
    creditTotal: toMoneyNumber(creditSum._sum.amountArs),
    debitTotalUsd: toMoneyNumber(debitSum._sum.amountUsd),
    creditTotalUsd: toMoneyNumber(creditSum._sum.amountUsd),
    netTotal: toMoneyNumber(debitSum._sum.amountArs) - toMoneyNumber(creditSum._sum.amountArs),
    netTotalUsd: toMoneyNumber(debitSum._sum.amountUsd) - toMoneyNumber(creditSum._sum.amountUsd),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    statementId,
    date,
    merchantName,
    amountArs,
    amountUsd,
    categoryId,
    transactionType,
    isInstallment,
    installmentCurrent,
    installmentTotal,
    recurring,
  } = body as {
    statementId?: string;
    date: string;
    merchantName: string;
    amountArs: number;
    amountUsd?: number;
    categoryId?: string;
    transactionType?: string;
    isInstallment?: boolean;
    installmentCurrent?: number;
    installmentTotal?: number;
    recurring?: {
      enabled?: boolean;
      nextRunAt?: string;
      reminderDaysBefore?: number;
      requiresConfirmation?: boolean;
    };
  };

  if (!date || !merchantName || amountArs == null) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  try {
    const tx = await createManualTransactionForUser(session.userId, {
      date,
      statementId,
      merchantName,
      amountArs,
      amountUsd,
      categoryId,
      transactionType,
      isInstallment,
      installmentCurrent,
      installmentTotal,
    });

    if (recurring?.enabled) {
      await prisma.recurringTransaction.create({
        data: {
          userId: session.userId,
          merchantName: merchantName.trim(),
          amountArs: tx.amountArs,
          amountUsd: tx.amountUsd,
          currency: amountUsd != null ? "USD" : "ARS",
          transactionType: transactionType ?? "DEBIT",
          categoryId: categoryId ?? null,
          frequency: "MONTHLY",
          dayOfMonth: parseDateOnly(recurring.nextRunAt ?? date).getUTCDate(),
          nextRunAt: parseDateOnly(recurring.nextRunAt ?? date),
          requiresConfirmation: recurring.requiresConfirmation ?? true,
          reminderDaysBefore: Number(recurring.reminderDaysBefore ?? 3),
        },
      });
    }

    return NextResponse.json(
      {
        ...tx,
        amountArs: toMoneyNumber(tx.amountArs),
        amountUsd: toNullableMoneyNumber(tx.amountUsd),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al crear movimiento" },
      { status: 400 }
    );
  }
}
