import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toMoneyNumber, toNullableMoneyNumber } from "@/lib/money";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary({
  months = 6,
  from,
  to,
  userId,
  origin,
}: { months?: number; from?: Date; to?: Date; userId?: string; origin?: string } = {}) {
  const now = new Date();
  const since = from ?? new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const until = to ?? now;

  const userFilter = userId ? { userId } : {};
  const txPeriodFilter: Prisma.TransactionWhereInput = {
    ...userFilter,
    deletedAt: null,
    date: { gte: since, lte: until },
  };

  const selectedOrigins = (origin ?? "all").split(",").filter(Boolean);
  const originClauses: Prisma.TransactionWhereInput[] = [];
  if (selectedOrigins.includes("manual")) originClauses.push({ source: "MANUAL" });
  if (selectedOrigins.includes("statement")) originClauses.push({ statementId: { not: null } });
  if (selectedOrigins.includes("payslip")) originClauses.push({ payslip: { isNot: null } });
  const originFilter: Prisma.TransactionWhereInput =
    !selectedOrigins.length || selectedOrigins.includes("all") ? {} : { OR: originClauses };

  const scopedTxPeriodFilter: Prisma.TransactionWhereInput = {
    ...txPeriodFilter,
    ...originFilter,
  };

  const [
    incomeAgg,
    expenseAgg,
    txByCategory,
    txForTrend,
    topMerchantsRaw,
    categories,
    totalTransactionCount,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...scopedTxPeriodFilter, transactionType: "CREDIT" },
      _sum: { amountArs: true, amountUsd: true },
    }),
    prisma.transaction.aggregate({
      where: { ...scopedTxPeriodFilter, transactionType: "DEBIT" },
      _sum: { amountArs: true, amountUsd: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...scopedTxPeriodFilter, transactionType: "DEBIT" },
      _sum: { amountArs: true },
      _count: { id: true },
      orderBy: { _sum: { amountArs: "desc" } },
    }),
    prisma.transaction.findMany({
      where: scopedTxPeriodFilter,
      select: { date: true, amountArs: true, amountUsd: true, transactionType: true },
    }),
    prisma.transaction.groupBy({
      by: ["normalizedMerchant", "categoryId"],
      where: { ...scopedTxPeriodFilter, transactionType: "DEBIT" },
      _sum: { amountArs: true },
      _count: { id: true },
      orderBy: { _sum: { amountArs: "desc" } },
      take: 10,
    }),
    prisma.category.findMany(),
    prisma.transaction.count({ where: scopedTxPeriodFilter }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const totalCatSpend = txByCategory.reduce((s, g) => s + toMoneyNumber(g._sum.amountArs), 0);
  const totalIncomeArs = toMoneyNumber(incomeAgg._sum.amountArs);
  const totalExpenseArs = toMoneyNumber(expenseAgg._sum.amountArs);
  const totalIncomeUsd = toMoneyNumber(incomeAgg._sum.amountUsd);
  const totalExpenseUsd = toMoneyNumber(expenseAgg._sum.amountUsd);
  const spendingByCategory = txByCategory.map((g) => {
    const cat = g.categoryId ? catMap.get(g.categoryId) : null;
    const total = toMoneyNumber(g._sum.amountArs);
    return {
      categoryId: g.categoryId ?? "unknown",
      categoryName: cat?.name ?? "Sin categoría",
      color: cat?.color ?? "#94A3B8",
      total,
      transactionCount: g._count.id,
      percentage: totalCatSpend > 0 ? (total / totalCatSpend) * 100 : 0,
    };
  });

  const monthlyMap = new Map<string, { income: number; expenses: number; netBalance: number; transactionCount: number }>();
  for (const t of txForTrend) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyMap.get(key) ?? { income: 0, expenses: 0, netBalance: 0, transactionCount: 0 };
    const amount = toMoneyNumber(t.amountArs);
    if (t.transactionType === "CREDIT") {
      existing.income += amount;
      existing.netBalance += amount;
    } else {
      existing.expenses += amount;
      existing.netBalance -= amount;
    }
    existing.transactionCount += 1;
    monthlyMap.set(key, existing);
  }
  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  const topMerchants = topMerchantsRaw.map((m) => {
    const cat = m.categoryId ? catMap.get(m.categoryId) : null;
    return {
      merchantName: m.normalizedMerchant ?? "Desconocido",
      total: toMoneyNumber(m._sum.amountArs),
      transactionCount: m._count.id,
      categoryName: cat?.name ?? "Otros",
      categoryColor: cat?.color ?? "#94A3B8",
    };
  });

  return {
    totalTransactionCount,
    origin: origin ?? "all",
    totalIncomeArs,
    totalExpenseArs,
    netBalanceArs: totalIncomeArs - totalExpenseArs,
    totalIncomeUsd,
    totalExpenseUsd,
    netBalanceUsd: totalIncomeUsd - totalExpenseUsd,
    spendingByCategory,
    monthlyTrend,
    topMerchants,
    totalCategorySpend: totalCatSpend,
    cumulativeNetSavings: monthlyTrend.reduce((sum, item) => sum + item.netBalance, 0),
    averageMonthlyNet: monthlyTrend.length
      ? monthlyTrend.reduce((sum, item) => sum + item.netBalance, 0) / monthlyTrend.length
      : 0,
  };
}

// ─── Statements ───────────────────────────────────────────────────────────────

export async function getStatements(page = 1, limit = 50, bankName?: string, userId?: string) {
  const where = {
    ...(bankName ? { bankName } : {}),
    ...(userId ? { userId } : {}),
  };
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

  return {
    total,
    statements: statements.map((statement) => ({
      ...statement,
      balanceSummary: statement.balanceSummary
        ? {
            ...statement.balanceSummary,
            previousBalance: toMoneyNumber(statement.balanceSummary.previousBalance),
            previousBalanceUsd: toNullableMoneyNumber(statement.balanceSummary.previousBalanceUsd),
            paymentsApplied: toMoneyNumber(statement.balanceSummary.paymentsApplied),
            totalConsumption: toMoneyNumber(statement.balanceSummary.totalConsumption),
            commissionCuentaFull: toMoneyNumber(statement.balanceSummary.commissionCuentaFull),
            selloTax: toMoneyNumber(statement.balanceSummary.selloTax),
            ivaTax: toMoneyNumber(statement.balanceSummary.ivaTax),
            iibbTax: toMoneyNumber(statement.balanceSummary.iibbTax),
            financingInterest: toMoneyNumber(statement.balanceSummary.financingInterest),
            currentBalance: toMoneyNumber(statement.balanceSummary.currentBalance),
            currentBalanceUsd: toNullableMoneyNumber(statement.balanceSummary.currentBalanceUsd),
            minimumPayment: toMoneyNumber(statement.balanceSummary.minimumPayment),
          }
        : null,
    })),
  };
}

export async function getStatementById(id: string, userId: string) {
  const statement = await prisma.statement.findFirst({
    where: { id, userId },
    include: {
      reviewedBy: { select: { username: true, displayName: true } },
      card: { include: { bank: true } },
      balanceSummary: true,
      transactions: {
        include: { category: true },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!statement) return null;

  return {
    ...statement,
    balanceSummary: statement.balanceSummary
      ? {
          ...statement.balanceSummary,
          previousBalance: toMoneyNumber(statement.balanceSummary.previousBalance),
          previousBalanceUsd: toNullableMoneyNumber(statement.balanceSummary.previousBalanceUsd),
          paymentsApplied: toMoneyNumber(statement.balanceSummary.paymentsApplied),
          totalConsumption: toMoneyNumber(statement.balanceSummary.totalConsumption),
          commissionCuentaFull: toMoneyNumber(statement.balanceSummary.commissionCuentaFull),
          selloTax: toMoneyNumber(statement.balanceSummary.selloTax),
          ivaTax: toMoneyNumber(statement.balanceSummary.ivaTax),
          iibbTax: toMoneyNumber(statement.balanceSummary.iibbTax),
          financingInterest: toMoneyNumber(statement.balanceSummary.financingInterest),
          currentBalance: toMoneyNumber(statement.balanceSummary.currentBalance),
          currentBalanceUsd: toNullableMoneyNumber(statement.balanceSummary.currentBalanceUsd),
          minimumPayment: toMoneyNumber(statement.balanceSummary.minimumPayment),
        }
      : null,
    transactions: statement.transactions.map((transaction) => ({
      ...transaction,
      amountArs: toMoneyNumber(transaction.amountArs),
      amountUsd: toNullableMoneyNumber(transaction.amountUsd),
    })),
  };
}

export type StatementWithTransactions = NonNullable<Awaited<ReturnType<typeof getStatementById>>>;
