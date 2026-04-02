import { prisma } from "@/lib/prisma";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    latestStatements,
    thisMonthTx,
    lastMonthTx,
    txByCategory,
    txForTrend,
    topMerchantsRaw,
    feeAgg,
    categories,
  ] = await Promise.all([
    prisma.statement.findMany({
      orderBy: { periodEnd: "desc" },
      take: 20,
      include: { balanceSummary: true },
    }),
    prisma.transaction.aggregate({
      where: { date: { gte: thisMonthStart }, transactionType: "DEBIT" },
      _sum: { amountArs: true },
    }),
    prisma.transaction.aggregate({
      where: { date: { gte: lastMonthStart, lt: thisMonthStart }, transactionType: "DEBIT" },
      _sum: { amountArs: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { date: { gte: since }, transactionType: "DEBIT" },
      _sum: { amountArs: true },
      _count: { id: true },
      orderBy: { _sum: { amountArs: "desc" } },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: since }, transactionType: "DEBIT" },
      select: { date: true, amountArs: true, amountUsd: true },
    }),
    prisma.transaction.groupBy({
      by: ["normalizedMerchant", "categoryId"],
      where: { date: { gte: since }, transactionType: "DEBIT" },
      _sum: { amountArs: true },
      _count: { id: true },
      orderBy: { _sum: { amountArs: "desc" } },
      take: 10,
    }),
    prisma.balanceSummary.aggregate({
      where: { statement: { periodEnd: { gte: since } } },
      _sum: {
        commissionCuentaFull: true,
        selloTax: true,
        ivaTax: true,
        iibbTax: true,
        financingInterest: true,
      },
    }),
    prisma.category.findMany(),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const totalCurrentBalance = latestStatements.reduce(
    (sum, s) => sum + (s.balanceSummary?.currentBalance ?? 0),
    0
  );
  const totalCurrentBalanceUsd = latestStatements.reduce(
    (sum, s) => sum + (s.balanceSummary?.currentBalanceUsd ?? 0),
    0
  );

  const thisMonth = thisMonthTx._sum.amountArs ?? 0;
  const lastMonth = lastMonthTx._sum.amountArs ?? 0;
  const spendingChangePercent =
    lastMonth === 0 ? 0 : ((thisMonth - lastMonth) / lastMonth) * 100;

  const totalCatSpend = txByCategory.reduce((s, g) => s + (g._sum.amountArs ?? 0), 0);
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
    totalCurrentBalance,
    totalCurrentBalanceUsd,
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

export async function getStatements(page = 1, limit = 50, bankName?: string) {
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
