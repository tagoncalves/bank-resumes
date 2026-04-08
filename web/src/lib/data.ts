import { prisma } from "@/lib/prisma";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary({
  months = 6,
  from,
  to,
  userId,
}: { months?: number; from?: Date; to?: Date; userId?: string } = {}) {
  const now = new Date();
  const since = from ?? new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const until = to ?? now;

  // For this-month / last-month comparison use the filter boundaries when a specific month is set
  const periodStart = from ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const prevPeriodStart = from
    ? new Date(from.getFullYear(), from.getMonth() - 1, 1)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = to ?? now;

  const userFilter = userId ? { userId } : {};

  const [
    thisMonthTx,
    lastMonthTx,
    txByCategory,
    txForTrend,
    topMerchantsRaw,
    feeAgg,
    categories,
    totalTransactionCount,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...userFilter, date: { gte: periodStart, lte: periodEnd }, transactionType: "DEBIT", deletedAt: null },
      _sum: { amountArs: true },
    }),
    prisma.transaction.aggregate({
      where: { ...userFilter, date: { gte: prevPeriodStart, lt: periodStart }, transactionType: "DEBIT", deletedAt: null },
      _sum: { amountArs: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...userFilter, date: { gte: since, lte: until }, transactionType: "DEBIT", deletedAt: null },
      _sum: { amountArs: true },
      _count: { id: true },
      orderBy: { _sum: { amountArs: "desc" } },
    }),
    prisma.transaction.findMany({
      where: { ...userFilter, date: { gte: since, lte: until }, transactionType: "DEBIT", deletedAt: null },
      select: { date: true, amountArs: true, amountUsd: true },
    }),
    prisma.transaction.groupBy({
      by: ["normalizedMerchant", "categoryId"],
      where: { ...userFilter, date: { gte: since, lte: until }, transactionType: "DEBIT", deletedAt: null },
      _sum: { amountArs: true },
      _count: { id: true },
      orderBy: { _sum: { amountArs: "desc" } },
      take: 10,
    }),
    prisma.balanceSummary.aggregate({
      where: { statement: { ...(userId ? { userId } : {}), periodEnd: { gte: since, lte: until } } },
      _sum: {
        commissionCuentaFull: true,
        selloTax: true,
        ivaTax: true,
        iibbTax: true,
        financingInterest: true,
      },
    }),
    prisma.category.findMany(),
    prisma.transaction.count({ where: { ...userFilter, date: { gte: since, lte: until }, deletedAt: null } }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const thisMonth = thisMonthTx._sum.amountArs ?? 0;
  const lastMonth = lastMonthTx._sum.amountArs ?? 0;
  const spendingChangePercent =
    lastMonth === 0 ? 0 : ((thisMonth - lastMonth) / lastMonth) * 100;

  const totalCatSpend = txByCategory.reduce((s, g) => s + (g._sum.amountArs ?? 0), 0);
  const totalPeriodSpendingUsd = txForTrend.reduce((s, t) => s + (t.amountUsd ?? 0), 0);
  const spendingByCategory = txByCategory.map((g) => {
    const cat = g.categoryId ? catMap.get(g.categoryId) : null;
    return {
      categoryId: g.categoryId ?? "unknown",
      categoryName: cat?.name ?? "Sin categoría",
      color: cat?.color ?? "#94A3B8",
      total: g._sum.amountArs ?? 0,
      transactionCount: g._count.id,
      percentage: totalCatSpend > 0 ? ((g._sum.amountArs ?? 0) / totalCatSpend) * 100 : 0,
    };
  });

  const monthlyMap = new Map<string, { totalSpending: number; totalSpendingUsd: number; transactionCount: number }>();
  for (const t of txForTrend) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyMap.get(key) ?? { totalSpending: 0, totalSpendingUsd: 0, transactionCount: 0 };
    existing.totalSpending += t.amountArs;
    existing.totalSpendingUsd += t.amountUsd ?? 0;
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
      total: m._sum.amountArs ?? 0,
      transactionCount: m._count.id,
      categoryName: cat?.name ?? "Otros",
      categoryColor: cat?.color ?? "#94A3B8",
    };
  });

  const commissions = feeAgg._sum.commissionCuentaFull ?? 0;
  const selloTax = feeAgg._sum.selloTax ?? 0;
  const ivaTax = feeAgg._sum.ivaTax ?? 0;
  const iibbTax = feeAgg._sum.iibbTax ?? 0;
  const financingInterest = feeAgg._sum.financingInterest ?? 0;

  return {
    totalTransactionCount,
    totalCurrentBalance: totalCatSpend,
    totalCurrentBalanceUsd: totalPeriodSpendingUsd,
    totalSpendingThisMonth: thisMonth,
    totalSpendingLastMonth: lastMonth,
    spendingChangePercent,
    spendingByCategory,
    monthlyTrend,
    topMerchants,
    feeBreakdown: {
      commissions,
      selloTax,
      ivaTax,
      iibbTax,
      financingInterest,
      total: commissions + selloTax + ivaTax + iibbTax + financingInterest,
    },
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
  return { total, statements };
}

export async function getStatementById(id: string) {
  return prisma.statement.findUnique({
    where: { id },
    include: {
      card: { include: { bank: true } },
      balanceSummary: true,
      transactions: {
        include: { category: true },
        orderBy: { date: "desc" },
      },
    },
  });
}

export type StatementWithTransactions = NonNullable<Awaited<ReturnType<typeof getStatementById>>>;
