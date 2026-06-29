import { prisma } from "@/lib/prisma";
import { money, optionalMoneyInput, requireMoneyInput } from "@/lib/money";
import { parseDateOnly } from "@/lib/dates";
import { inferTransactionClassification, type TransactionNature, type TransactionReviewStatus } from "@/lib/transactions/classification";

export interface CreateTransactionInput {
  statementId?: string | null;
  date: string | Date;
  merchantName: string;
  amountArs: number;
  amountUsd?: number | null;
  categoryId?: string | null;
  transactionType?: string;
  source?: string;
  isInstallment?: boolean;
  isSubscription?: boolean;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  nature?: TransactionNature;
  reviewStatus?: TransactionReviewStatus;
  spendingImpact?: boolean;
  cashflowImpact?: boolean;
}

export async function createManualTransactionForUser(userId: string | null, input: CreateTransactionInput) {
  if (!input.date || !input.merchantName || input.amountArs == null) {
    throw new Error("Faltan campos requeridos");
  }

  const parsedAmountArs = requireMoneyInput(input.amountArs, "amountArs");
  const parsedAmountUsd = optionalMoneyInput(input.amountUsd, "amountUsd");
  const merchantName = input.merchantName.trim();
  const transactionType = input.transactionType ?? "DEBIT";
  const classification = input.nature
    ? {
        nature: input.nature,
        reviewStatus: input.reviewStatus ?? "confirmed",
        spendingImpact: input.spendingImpact ?? ["expense", "subscription", "installment"].includes(input.nature),
        cashflowImpact: input.cashflowImpact ?? true,
      }
    : inferTransactionClassification({
        transactionType,
        source: input.source ?? "MANUAL",
        statementId: input.statementId,
        merchantName,
        isInstallment: input.isInstallment,
        isSubscription: input.isSubscription,
      });

  if (!merchantName) {
    throw new Error("Descripción inválida");
  }

  return prisma.transaction.create({
    data: {
      userId,
      statementId: input.statementId ?? null,
      date: parseDateOnly(input.date),
      merchantName,
      normalizedMerchant: merchantName.replace(/\s+/g, " "),
      amountArs: parsedAmountArs,
      amountUsd: parsedAmountUsd ?? null,
      categoryId: input.categoryId ?? null,
      source: input.source ?? "MANUAL",
      transactionType,
      nature: classification.nature,
      reviewStatus: classification.reviewStatus,
      spendingImpact: classification.spendingImpact,
      cashflowImpact: classification.cashflowImpact,
      isInstallment: input.isInstallment ?? false,
      isSubscription: input.isSubscription ?? false,
      installmentCurrent: input.installmentCurrent ?? null,
      installmentTotal: input.installmentTotal ?? null,
    },
    include: { category: true },
  });
}

export function decimalToNumber(value: unknown) {
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value ?? 0);
}

export function recurringAmountInput(amount: number | string) {
  return money(typeof amount === "number" ? amount : Number(amount));
}
