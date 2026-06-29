import { prisma } from "@/lib/prisma";
import { categorizeTransaction } from "@/lib/categorizer";
import { money, nullableMoney, toMoneyNumber } from "@/lib/money";
import { parseDateOnly } from "@/lib/dates";
import { inferTransactionClassification } from "@/lib/transactions/classification";
import type { AIParsedStatement, ParsedStatement, ParsedTransaction } from "@/lib/pdf-parser/types";

const PAYMENT_KEYWORDS = ["PAGO", "CANCELACION", "CANCELACIÓN", "DEUDA", "RESUMEN ANTERIOR"];

type PersistOptions = {
  userId?: string | null;
  sourceHash: string;
  rawFilename: string;
  storedFilename?: string | null;
  importMethod: "NATIVE" | "AI";
  processingStatus?: "COMPLETED" | "REVIEW_REQUIRED" | "PRELIMINARY";
  analysisProvider?: string | null;
  analysisModel?: string | null;
  analysisPromptVersion?: string | null;
  analysisConfidence?: number | null;
  analysisNotes?: string[];
  analysisStructuredJson?: string | null;
};

function isPaymentDescription(value: string) {
  const normalized = value.toUpperCase();
  return PAYMENT_KEYWORDS.some((kw) => normalized.includes(kw));
}

function previousCalendarMonthRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0, 23, 59, 59, 999));
  return { start, end };
}

export async function persistParsedStatement(
  parsed: ParsedStatement | AIParsedStatement,
  options: PersistOptions
) {
  const { header, balance_summary, transactions } = parsed;

  const bank = await prisma.bank.upsert({
    where: { name: header.bank_name },
    update: {},
    create: { name: header.bank_name },
  });

  const card = await prisma.card.upsert({
    where: { bankId_lastFour: { bankId: bank.id, lastFour: header.card_last_four } },
    update: { holderName: header.holder_name },
    create: {
      bankId: bank.id,
      lastFour: header.card_last_four,
      cardNetwork: header.card_network,
      holderName: header.holder_name,
      accountNumber: header.account_number,
    },
  });

  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((category) => [category.name, category.id]));

  return prisma.$transaction(async (tx) => {
    const statement = await tx.statement.create({
      data: {
        cardId: card.id,
        userId: options.userId ?? null,
        bankName: header.bank_name,
        importMethod: options.importMethod,
        processingStatus: options.processingStatus ?? "COMPLETED",
        parserVersion: parsed.parser_version,
        analysisProvider: options.analysisProvider ?? null,
        analysisModel: options.analysisModel ?? null,
        analysisPromptVersion: options.analysisPromptVersion ?? null,
        analysisConfidence: options.analysisConfidence ?? null,
        analysisNotes: options.analysisNotes?.length ? options.analysisNotes.join("\n") : null,
        analysisStructuredJson: options.analysisStructuredJson ?? null,
        periodStart: parseDateOnly(header.period_start),
        periodEnd: parseDateOnly(header.period_end),
        dueDate: parseDateOnly(header.due_date),
        rawFilename: options.rawFilename,
        storedFilename: options.storedFilename ?? null,
        sourceHash: options.sourceHash,
      },
    });

    await tx.balanceSummary.create({
      data: {
        statementId: statement.id,
        previousBalance: money(balance_summary.previous_balance),
        previousBalanceUsd: nullableMoney(balance_summary.previous_balance_usd),
        paymentsApplied: money(balance_summary.payments_applied),
        totalConsumption: money(balance_summary.total_consumption),
        commissionCuentaFull: money(balance_summary.commission_cuenta_full),
        selloTax: money(balance_summary.sello_tax),
        ivaTax: money(balance_summary.iva_tax),
        iibbTax: money(balance_summary.iibb_tax),
        financingInterest: money(balance_summary.financing_interest),
        currentBalance: money(balance_summary.current_balance),
        currentBalanceUsd: nullableMoney(balance_summary.current_balance_usd),
        minimumPayment: money(balance_summary.minimum_payment),
        tnaArs: balance_summary.tna_ars,
        temArs: balance_summary.tem_ars,
        teaArs: balance_summary.tea_ars,
        tnaUsd: balance_summary.tna_usd,
        temUsd: balance_summary.tem_usd,
        teaUsd: balance_summary.tea_usd,
      },
    });

    for (const transaction of transactions) {
      const categoryName = categorizeTransaction(transaction.merchant_name);
      const categoryId = categoryMap.get(categoryName) ?? categoryMap.get("Otros");
      const isInstallment = !!(transaction.installment_current && transaction.installment_total);
      const classification = inferTransactionClassification({
        transactionType: "DEBIT",
        source: "IMPORTED",
        statementId: statement.id,
        merchantName: transaction.merchant_name,
        isInstallment,
      });

      await tx.transaction.create({
        data: {
          statementId: statement.id,
          userId: options.userId ?? null,
          categoryId: categoryId ?? null,
          date: parseDateOnly(transaction.date),
          merchantName: transaction.merchant_name,
          normalizedMerchant: transaction.merchant_name.trim().replace(/\s+/g, " "),
          voucherNumber: transaction.voucher_number,
          installmentCurrent: transaction.installment_current,
          installmentTotal: transaction.installment_total,
          amountArs: money(transaction.amount_ars),
          amountUsd: nullableMoney(transaction.amount_usd),
          cardLastFour: transaction.card_last_four,
          transactionType: "DEBIT",
          nature: classification.nature,
          reviewStatus: classification.reviewStatus,
          spendingImpact: classification.spendingImpact,
          cashflowImpact: classification.cashflowImpact,
          isInstallment,
        },
      });
    }

    return statement;
  });
}

export async function linkPaymentsToStatement(
  statementId: string,
  userId: string | null,
  parsedTransactions?: ParsedTransaction[],
) {
  if (!userId) return;

  const statement = await prisma.statement.findUniqueOrThrow({
    where: { id: statementId },
    select: {
      cardId: true,
      bankName: true,
      card: { select: { lastFour: true } },
      periodStart: true,
      periodEnd: true,
      balanceSummary: { select: { paymentsApplied: true } },
    },
  });

  const previousMonth = previousCalendarMonthRange(statement.periodEnd);
  const previousStatement = await prisma.statement.findFirst({
    where: {
      id: { not: statementId },
      userId,
      cardId: statement.cardId,
      bankName: statement.bankName,
      periodEnd: { gte: previousMonth.start, lte: previousMonth.end },
      processingStatus: { not: "REJECTED" },
    },
    select: { id: true, dueDate: true },
    orderBy: { periodEnd: "desc" },
  });

  // 1. Link orphan DEBIT transactions matching this card within the period
  await prisma.transaction.updateMany({
    where: {
      userId,
      statementId: null,
      cardLastFour: statement.card.lastFour,
      date: { gte: statement.periodStart, lte: statement.periodEnd },
      transactionType: "DEBIT",
      deletedAt: null,
    },
    data: {
      statementId,
      nature: "credit_card_payment",
      reviewStatus: "excluded_from_spending",
      spendingImpact: false,
      cashflowImpact: true,
    },
  });

  // 2. Payment lines in the current statement usually settle the previous
  // statement. Reassign them to the immediately previous statement when it exists.
  let linkedImportedPayment = false;
  const targetStatementId = previousStatement?.id ?? statementId;

  for (const tx of parsedTransactions ?? []) {
    const isPayment = isPaymentDescription(tx.merchant_name);
    if (!isPayment) continue;

    const amount = tx.amount_ars;
    const txDate = parseDateOnly(tx.date);
    const threeDaysBefore = new Date(txDate.getTime() - 3 * 86400000);
    const threeDaysAfter = new Date(txDate.getTime() + 3 * 86400000);

    const importedTx = await prisma.transaction.findFirst({
      where: {
        statementId,
        merchantName: tx.merchant_name,
        amountArs: money(amount),
        deletedAt: null,
      },
    });
    if (!importedTx) continue;

    const existingTx = await prisma.transaction.findFirst({
      where: {
        id: { not: importedTx.id },
        userId,
        statementId: targetStatementId,
        transactionType: "DEBIT",
        cardLastFour: statement.card.lastFour,
        amountArs: money(amount),
        date: { gte: threeDaysBefore, lte: threeDaysAfter },
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
    linkedImportedPayment = true;

    if (!existingTx) {
      await prisma.transaction.update({
        where: { id: importedTx.id },
        data: {
          statementId: targetStatementId,
          nature: "credit_card_payment",
          reviewStatus: "excluded_from_spending",
          spendingImpact: false,
          cashflowImpact: true,
        },
      });
      continue;
    }

    await prisma.$transaction([
      prisma.transaction.delete({ where: { id: importedTx.id } }),
      prisma.transaction.update({
        where: { id: existingTx.id },
        data: {
          statementId: targetStatementId,
          nature: "credit_card_payment",
          reviewStatus: "excluded_from_spending",
          spendingImpact: false,
          cashflowImpact: true,
        },
      }),
    ]);
  }

  if (!previousStatement || linkedImportedPayment) return;

  const paymentsApplied = Math.abs(toMoneyNumber(statement.balanceSummary?.paymentsApplied));
  if (paymentsApplied <= 0) return;

  const existingSynthetic = await prisma.transaction.findFirst({
    where: {
      userId,
      statementId: previousStatement.id,
      transactionType: "DEBIT",
      nature: "credit_card_payment",
      cardLastFour: statement.card.lastFour,
      amountArs: money(paymentsApplied),
      deletedAt: null,
    },
  });
  if (existingSynthetic) return;

  const merchantName = `Pago resumen anterior ${statement.bankName} •••• ${statement.card.lastFour}`;
  await prisma.transaction.create({
    data: {
      statementId: previousStatement.id,
      userId,
      date: statement.periodStart,
      merchantName,
      normalizedMerchant: merchantName,
      amountArs: money(paymentsApplied),
      amountUsd: null,
      cardLastFour: statement.card.lastFour,
      transactionType: "DEBIT",
      nature: "credit_card_payment",
      reviewStatus: "excluded_from_spending",
      spendingImpact: false,
      cashflowImpact: true,
      source: "IMPORTED",
    },
  });
}

export async function createTransactionsFromStoredAnalysis(
  statementId: string,
  userId: string | null,
) {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    select: { analysisStructuredJson: true },
  });

  if (!statement?.analysisStructuredJson) {
    throw new Error("No hay análisis almacenado para crear transacciones");
  }

  const parsed = JSON.parse(statement.analysisStructuredJson) as AIParsedStatement;
  const { transactions, header } = parsed;

  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

  await prisma.$transaction(async (tx) => {
    for (const transaction of transactions) {
      const categoryName = categorizeTransaction(transaction.merchant_name);
      const categoryId = categoryMap.get(categoryName) ?? categoryMap.get("Otros");
      const isInstallment = !!(transaction.installment_current && transaction.installment_total);
      const classification = inferTransactionClassification({
        transactionType: "DEBIT",
        source: "IMPORTED",
        statementId,
        merchantName: transaction.merchant_name,
        isInstallment,
      });

      await tx.transaction.create({
        data: {
          statementId,
          userId: userId ?? null,
          categoryId: categoryId ?? null,
          date: parseDateOnly(transaction.date),
          merchantName: transaction.merchant_name,
          normalizedMerchant: transaction.merchant_name.trim().replace(/\s+/g, " "),
          voucherNumber: transaction.voucher_number,
          installmentCurrent: transaction.installment_current,
          installmentTotal: transaction.installment_total,
          amountArs: money(transaction.amount_ars),
          amountUsd: nullableMoney(transaction.amount_usd),
          cardLastFour: transaction.card_last_four,
          transactionType: "DEBIT",
          nature: classification.nature,
          reviewStatus: classification.reviewStatus,
          spendingImpact: classification.spendingImpact,
          cashflowImpact: classification.cashflowImpact,
          isInstallment,
        },
      });
    }
  });

  await linkPaymentsToStatement(statementId, userId, transactions);
}

export async function deleteStatementAndRequeue(statementId: string) {
  const importJob = await prisma.importJob.findFirst({
    where: {
      statementId,
      importMethod: "AI",
    },
    orderBy: { createdAt: "desc" },
  });

  // Delete statement (cascade: balanceSummary, transactions)
  await prisma.statement.delete({ where: { id: statementId } });

  // Re-queue the import job for re-analysis
  if (importJob) {
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: "QUEUED",
        statementId: null,
        bankName: null,
        analysisProvider: null,
        analysisModel: null,
        analysisPromptVersion: null,
        analysisConfidence: null,
        analysisNotes: null,
        sourceTextExcerpt: null,
        aiRequestPayload: null,
        aiRawResponse: null,
        aiParsedResult: null,
        errorMessage: null,
        attemptCount: 0,
        lastProcessedAt: null,
      },
    });
  }

  return importJob;
}
