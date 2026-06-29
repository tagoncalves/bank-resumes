import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { toMoneyNumber, toNullableMoneyNumber } from "@/lib/money";
import { createManualTransactionForUser } from "@/lib/transactions/create-transaction";
import { dateInputValue, parseDateOnly, parseDateRangeEnd, parseDateRangeStart } from "@/lib/dates";
import { generateOccurrenceDates, nextOccurrenceAfter, normalizeFrequency, normalizeInterval } from "@/lib/recurring/schedule";
import { inferTransactionClassification, type TransactionNature, type TransactionReviewStatus } from "@/lib/transactions/classification";

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
  const nature = searchParams.get("nature");
  const reviewStatus = searchParams.get("reviewStatus");

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
  if (nature) {
    const natures = nature.split(",").filter(Boolean);
    if (natures.length === 1) {
      where.nature = natures[0];
    } else if (natures.length > 1) {
      where.nature = { in: natures };
    }
  }
  if (reviewStatus) {
    const statuses = reviewStatus.split(",").filter(Boolean);
    if (statuses.length === 1) {
      where.reviewStatus = statuses[0];
    } else if (statuses.length > 1) {
      where.reviewStatus = { in: statuses };
    }
  }
  const statementId = searchParams.get("statementId");
  if (statementId) {
    where.statementId = statementId;
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

  const [total, transactions, debitSum, creditSum, cashOutflowSum] = await Promise.all([
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
      where: { ...where, transactionType: "DEBIT", spendingImpact: true },
      _sum: { amountArs: true, amountUsd: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, transactionType: "CREDIT", cashflowImpact: true },
      _sum: { amountArs: true, amountUsd: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, transactionType: "DEBIT", cashflowImpact: true },
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
    cashOutflowTotal: toMoneyNumber(cashOutflowSum._sum.amountArs),
    excludedOutflowTotal: Math.max(0, toMoneyNumber(cashOutflowSum._sum.amountArs) - toMoneyNumber(debitSum._sum.amountArs)),
    debitTotalUsd: toMoneyNumber(debitSum._sum.amountUsd),
    creditTotalUsd: toMoneyNumber(creditSum._sum.amountUsd),
    cashOutflowTotalUsd: toMoneyNumber(cashOutflowSum._sum.amountUsd),
    excludedOutflowTotalUsd: Math.max(0, toMoneyNumber(cashOutflowSum._sum.amountUsd) - toMoneyNumber(debitSum._sum.amountUsd)),
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
    nature,
    reviewStatus,
    spendingImpact,
    cashflowImpact,
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
    nature?: TransactionNature;
    reviewStatus?: TransactionReviewStatus;
    spendingImpact?: boolean;
    cashflowImpact?: boolean;
    recurring?: {
      enabled?: boolean;
      anchorDate?: string;
      nextRunAt?: string;
      frequency?: string;
      interval?: number;
      reminderDaysBefore?: number;
      requiresConfirmation?: boolean;
      backfill?: {
        enabled?: boolean;
        from?: string;
        to?: string;
        mode?: "CREATE_TRANSACTIONS" | "PENDING_CONFIRMATION";
      };
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
      nature,
      reviewStatus,
      spendingImpact,
      cashflowImpact,
    });

    if (recurring?.enabled) {
      const frequency = normalizeFrequency(recurring.frequency);
      const interval = normalizeInterval(recurring.interval);
      const anchorDate = parseDateOnly(recurring.anchorDate ?? date);
      const backfillTo = parseDateOnly(recurring.backfill?.to ?? date);
      const backfillDates = recurring.backfill?.enabled && recurring.backfill.from
        ? generateOccurrenceDates({
            anchorDate,
            frequency,
            interval,
            from: recurring.backfill.from,
            to: backfillTo,
            max: 120,
          })
        : [];

      await prisma.$transaction(async (db) => {
        const recurringTransaction = await db.recurringTransaction.create({
          data: {
            userId: session.userId,
            merchantName: merchantName.trim(),
            amountArs: tx.amountArs,
            amountUsd: tx.amountUsd,
            currency: amountUsd != null ? "USD" : "ARS",
            transactionType: transactionType ?? "DEBIT",
            categoryId: categoryId ?? null,
            frequency,
            interval,
            anchorDate,
            dayOfMonth: anchorDate.getUTCDate(),
            nextRunAt: nextOccurrenceAfter({ anchorDate, frequency, interval, after: backfillDates.length ? backfillTo : new Date() }),
            requiresConfirmation: recurring.requiresConfirmation ?? true,
            reminderDaysBefore: Number(recurring.reminderDaysBefore ?? 3),
          },
        });

        for (const dueDate of backfillDates) {
          const isBaseTransactionDate = dateInputValue(dueDate) === dateInputValue(tx.date);
          const shouldCreate = recurring.backfill?.mode === "CREATE_TRANSACTIONS";
          const createdTx = isBaseTransactionDate
            ? tx
            : shouldCreate
            ? await (async () => {
                const classification = inferTransactionClassification({
                  transactionType: transactionType ?? "DEBIT",
                  source: "RECURRENT",
                  merchantName,
                });
                return db.transaction.create({
                  data: {
                    userId: session.userId,
                    date: dueDate,
                    merchantName: merchantName.trim(),
                    normalizedMerchant: merchantName.trim().replace(/\s+/g, " "),
                    amountArs: tx.amountArs,
                    amountUsd: tx.amountUsd,
                    categoryId: categoryId ?? null,
                    transactionType: transactionType ?? "DEBIT",
                    nature: classification.nature,
                    reviewStatus: classification.reviewStatus,
                    spendingImpact: classification.spendingImpact,
                    cashflowImpact: classification.cashflowImpact,
                    source: "RECURRENT",
                    isInstallment: false,
                  },
                });
              })()
            : null;

          await db.recurringTransactionOccurrence.create({
            data: {
              recurringTransactionId: recurringTransaction.id,
              dueDate,
              status: createdTx ? "EXECUTED" : "PENDING",
              transactionId: createdTx?.id ?? null,
              generationType: "BACKFILL",
              createdByMode: isBaseTransactionDate ? "BASE_TRANSACTION" : createdTx ? "BACKFILL_AUTO" : "CONFIRMATION",
            },
          });
        }
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
