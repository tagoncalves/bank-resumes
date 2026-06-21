import { prisma } from "@/lib/prisma";
import { money, optionalMoneyInput, requireMoneyInput } from "@/lib/money";

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
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
}

export async function createManualTransactionForUser(userId: string | null, input: CreateTransactionInput) {
  if (!input.date || !input.merchantName || input.amountArs == null) {
    throw new Error("Faltan campos requeridos");
  }

  const parsedAmountArs = requireMoneyInput(input.amountArs, "amountArs");
  const parsedAmountUsd = optionalMoneyInput(input.amountUsd, "amountUsd");
  const merchantName = input.merchantName.trim();

  if (!merchantName) {
    throw new Error("Descripción inválida");
  }

  return prisma.transaction.create({
    data: {
      userId,
      statementId: input.statementId ?? null,
      date: input.date instanceof Date ? input.date : new Date(input.date),
      merchantName,
      normalizedMerchant: merchantName.replace(/\s+/g, " "),
      amountArs: parsedAmountArs,
      amountUsd: parsedAmountUsd ?? null,
      categoryId: input.categoryId ?? null,
      source: input.source ?? "MANUAL",
      transactionType: input.transactionType ?? "DEBIT",
      isInstallment: input.isInstallment ?? false,
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
