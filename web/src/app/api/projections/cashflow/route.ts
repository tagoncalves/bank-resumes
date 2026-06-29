import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toMoneyNumber } from "@/lib/money";

function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calcMonthlyAmount(amount: number, frequency: string, interval: number): number {
  const safeInterval = Math.max(interval, 1);
  if (frequency === "MONTHLY") return amount / safeInterval;
  if (frequency === "WEEKLY") return amount * (52 / 12) / safeInterval;
  if (frequency === "YEARLY") return amount / (12 * safeInterval);
  if (frequency === "BIWEEKLY") return amount * (26 / 12) / safeInterval;
  return amount;
}

function projectionMonths(now: Date, months: number) {
  return Array.from({ length: months }, (_, index) => {
    const date = addMonths(now, index + 1);
    return { date, key: monthKey(date) };
  });
}

function estimateConfidence(sampleMonths: number, lookbackMonths: number) {
  if (sampleMonths >= Math.min(lookbackMonths, 4)) return "HIGH";
  if (sampleMonths >= 3) return "MEDIUM";
  return "LOW";
}

function recurringBackerKey(merchantName: string, amountArs: number, transactionType: string) {
  return `${merchantName.trim().toLowerCase()}|${Math.round(amountArs * 100)}|${transactionType}`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const months = Math.min(parseInt(searchParams.get("months") ?? "12"), 60);
  const lookback = parseInt(searchParams.get("lookback") ?? "6");

  const now = new Date();
  const monthsToProject = projectionMonths(now, months);
  const firstProjectionMonth = monthsToProject[0]?.date ?? addMonths(now, 1);
  const projectionMonthKeys = new Set(monthsToProject.map((m) => m.key));
  const lookbackFrom = addMonths(now, -lookback);

  // --- 1. Recurring transactions (both CREDIT and DEBIT) ---
  // Recurring rules are persisted, but projections should ignore stale rules left
  // behind after their source movements were deleted.
  const [recurringCandidates, activeRecurringBackers] = await Promise.all([
    prisma.recurringTransaction.findMany({
      where: { userId: session.userId, enabled: true },
      select: {
        merchantName: true,
        amountArs: true,
        transactionType: true,
        frequency: true,
        interval: true,
        occurrences: {
          where: { transaction: { deletedAt: null } },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.transaction.findMany({
      where: { userId: session.userId, deletedAt: null },
      select: { merchantName: true, amountArs: true, transactionType: true },
    }),
  ]);

  const activeRecurringBackerKeys = new Set(
    activeRecurringBackers.map((tx) => recurringBackerKey(tx.merchantName, toMoneyNumber(tx.amountArs), tx.transactionType)),
  );
  const recurrings = recurringCandidates.filter(
    (r) => r.occurrences.length > 0 || activeRecurringBackerKeys.has(recurringBackerKey(r.merchantName, toMoneyNumber(r.amountArs), r.transactionType)),
  );

  let monthlyRecurringIncome = 0;
  let monthlyRecurringExpense = 0;
  let recurringIncomeRulesCount = 0;
  let recurringExpenseRulesCount = 0;
  for (const r of recurrings) {
    const amount = calcMonthlyAmount(toMoneyNumber(r.amountArs), r.frequency, r.interval);
    if (r.transactionType === "CREDIT") {
      monthlyRecurringIncome += amount;
      recurringIncomeRulesCount += 1;
    } else {
      monthlyRecurringExpense += amount;
      recurringExpenseRulesCount += 1;
    }
  }

  // --- 2. Subscription transactions (marked as isSubscription) ---
  const subscriptionTxs = await prisma.transaction.findMany({
    where: {
      userId: session.userId,
      isSubscription: true,
      deletedAt: null,
      transactionType: "DEBIT",
      spendingImpact: true,
    },
    select: { merchantName: true, amountArs: true, date: true },
  });

  // Group subscriptions by merchant, compute average monthly per merchant
  const subByMerchant = new Map<string, number[]>();
  for (const tx of subscriptionTxs) {
    const key = tx.merchantName.trim().toLowerCase();
    if (!subByMerchant.has(key)) subByMerchant.set(key, []);
    subByMerchant.get(key)!.push(toMoneyNumber(tx.amountArs));
  }

  let monthlySubscriptionExpense = 0;
  const subscriptionDetails: Array<{ merchant: string; monthlyAvg: number }> = [];
  for (const [key, amounts] of subByMerchant) {
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    monthlySubscriptionExpense += avg;
    subscriptionDetails.push({
      merchant: amounts.length > 0 ? subscriptionTxs.find(t => t.merchantName.trim().toLowerCase() === key)?.merchantName ?? key : key,
      monthlyAvg: Math.round(avg),
    });
  }

  // --- 3. Historical variable averages ---
  // Exclude: installments, subscriptions, and payments (MANUAL + linked to statement = debt settlement)
  const history = await prisma.transaction.findMany({
    where: {
      userId: session.userId,
      deletedAt: null,
      date: { gte: lookbackFrom, lte: now },
      isSubscription: false,
      cashflowImpact: true,
      NOT: { source: "MANUAL", statementId: { not: null } },
    },
    select: { date: true, amountArs: true, transactionType: true, isInstallment: true, spendingImpact: true },
  });

  const monthlyMap = new Map<string, { income: number; expense: number }>();
  for (const tx of history) {
    const mk = monthKey(tx.date);
    if (!monthlyMap.has(mk)) monthlyMap.set(mk, { income: 0, expense: 0 });
    const entry = monthlyMap.get(mk)!;
    const amount = toMoneyNumber(tx.amountArs);
    if (tx.transactionType === "CREDIT") {
      entry.income += amount;
    } else if (!tx.isInstallment && tx.spendingImpact) {
      entry.expense += amount;
    }
  }

  const monthlyValues = Array.from(monthlyMap.values());
  const incomeMonths = monthlyValues.filter((m) => m.income > 0);
  const avgVariableIncome =
    incomeMonths.length > 0
      ? incomeMonths.reduce((s, m) => s + m.income, 0) / incomeMonths.length
      : 0;
  const expenseMonths = monthlyValues.filter((m) => m.expense > 0);
  const avgVariableExpense =
    expenseMonths.length > 0
      ? expenseMonths.reduce((s, m) => s + m.expense, 0) / expenseMonths.length
      : 0;

  // --- 4. Pending installments per future month ---
  const installmentGroups = await prisma.transaction.groupBy({
    by: ["merchantName", "amountArs"],
    where: {
      userId: session.userId,
      transactionType: "DEBIT",
      isInstallment: true,
      spendingImpact: true,
      deletedAt: null,
      installmentTotal: { not: null },
    },
    _max: { installmentCurrent: true, date: true },
    _min: { installmentTotal: true },
  });

  const installmentsByMonth = new Map<string, number>();
  for (const g of installmentGroups) {
    const total = g._min.installmentTotal ?? 0;
    const current = g._max.installmentCurrent ?? 0;
    if (current >= total) continue;
    const remaining = total - current;
    const amount = toMoneyNumber(g.amountArs);
    const lastDate = g._max.date ?? now;
    for (let i = 1; i <= remaining; i++) {
      const dueDate = addMonths(lastDate, i);
      if (dueDate < firstProjectionMonth) continue;
      const mk = monthKey(dueDate);
      if (!projectionMonthKeys.has(mk)) continue;
      installmentsByMonth.set(mk, (installmentsByMonth.get(mk) ?? 0) + amount);
    }
  }

  // --- 5. Build projection ---
  const projection: Array<{
    month: string;
    recurringIncome: number;
    recurringExpense: number;
    subscriptionExpense: number;
    installmentExpense: number;
    variableExpense: number;
    variableIncome: number;
    totalIncome: number;
    totalExpense: number;
    net: number;
    cumulative: number;
  }> = [];

  let cumulative = 0;
  const baseMonthlyExpense = Math.round(monthlyRecurringExpense + monthlySubscriptionExpense + avgVariableExpense);
  for (const { key: mk } of monthsToProject) {
    const income = Math.round(monthlyRecurringIncome + avgVariableIncome);
    const installmentExpense = Math.round(installmentsByMonth.get(mk) ?? 0);
    const expense = baseMonthlyExpense + installmentExpense;
    const net = income - expense;
    cumulative += net;
    projection.push({
      month: mk,
      recurringIncome: Math.round(monthlyRecurringIncome),
      recurringExpense: Math.round(monthlyRecurringExpense),
      subscriptionExpense: Math.round(monthlySubscriptionExpense),
      installmentExpense,
      variableExpense: Math.round(avgVariableExpense),
      variableIncome: Math.round(avgVariableIncome),
      totalIncome: income,
      totalExpense: expense,
      net,
      cumulative: Math.round(cumulative),
    });
  }

  const totalPendingInstallments = Array.from(installmentsByMonth.values()).reduce((s, v) => s + v, 0);
  const maxMonthlyProjectedExpense = projection.reduce((max, p) => Math.max(max, p.totalExpense), baseMonthlyExpense);

  return NextResponse.json({
    projection,
    meta: {
      mode: "projected",
      startsAtMonth: monthsToProject[0]?.key ?? null,
      endsAtMonth: monthsToProject.at(-1)?.key ?? null,
      months,
      lookbackMonths: lookback,
    },
    breakdown: {
      recurringIncome: Math.round(monthlyRecurringIncome),
      recurringExpense: Math.round(monthlyRecurringExpense),
      subscriptionExpense: Math.round(monthlySubscriptionExpense),
      subscriptionDetails,
      variableIncome: Math.round(avgVariableIncome),
      variableExpense: Math.round(avgVariableExpense),
      baseMonthlyExpense,
      maxMonthlyProjectedExpense,
      incomeMonthsCount: incomeMonths.length,
      expenseMonthsCount: expenseMonths.length,
      recurringIncomeRulesCount,
      recurringExpenseRulesCount,
      variableIncomeConfidence: estimateConfidence(incomeMonths.length, lookback),
      variableExpenseConfidence: estimateConfidence(expenseMonths.length, lookback),
    },
    pendingInstallments: {
      totalAmount: Math.round(totalPendingInstallments),
      byMonth: Object.fromEntries(
        Array.from(installmentsByMonth.entries())
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
  });
}
