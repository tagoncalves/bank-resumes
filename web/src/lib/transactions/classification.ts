export const SPENDING_NATURES = ["expense", "subscription", "installment"] as const;
export const INCOME_NATURE = "income";

export type TransactionNature =
  | "income"
  | "expense"
  | "subscription"
  | "installment"
  | "credit_card_payment"
  | "transfer"
  | "refund"
  | "manual_adjustment"
  | "ignored";

export type TransactionReviewStatus =
  | "confirmed"
  | "auto_categorized"
  | "needs_review"
  | "duplicate_candidate"
  | "excluded_from_spending";

export interface InferTransactionClassificationInput {
  transactionType?: string | null;
  source?: string | null;
  statementId?: string | null;
  merchantName?: string | null;
  normalizedMerchant?: string | null;
  isInstallment?: boolean | null;
  isSubscription?: boolean | null;
  isReversal?: boolean | null;
}

export function isSpendingNature(nature?: string | null) {
  return SPENDING_NATURES.includes(nature as (typeof SPENDING_NATURES)[number]);
}

export function inferTransactionClassification(input: InferTransactionClassificationInput): {
  nature: TransactionNature;
  reviewStatus: TransactionReviewStatus;
  spendingImpact: boolean;
  cashflowImpact: boolean;
} {
  const description = `${input.normalizedMerchant ?? ""} ${input.merchantName ?? ""}`.toLowerCase();
  const isCredit = input.transactionType === "CREDIT";
  const isStatementPayment = input.source === "MANUAL" && Boolean(input.statementId) && !isCredit;
  const looksLikeTransfer = /transfer|transferencia|traspaso|cuenta propia|entre cuentas/.test(description);
  const looksLikeCardPayment = /pago.*(tarjeta|resumen)|pago\s+(galicia|bbva|visa|mastercard|amex)/.test(description);

  if (isCredit) {
    return {
      nature: input.isReversal ? "refund" : "income",
      reviewStatus: input.isReversal ? "needs_review" : "auto_categorized",
      spendingImpact: false,
      cashflowImpact: true,
    };
  }

  if (isStatementPayment || looksLikeCardPayment) {
    return {
      nature: "credit_card_payment",
      reviewStatus: "excluded_from_spending",
      spendingImpact: false,
      cashflowImpact: true,
    };
  }

  if (looksLikeTransfer) {
    return {
      nature: "transfer",
      reviewStatus: "excluded_from_spending",
      spendingImpact: false,
      cashflowImpact: true,
    };
  }

  if (input.isInstallment) {
    return { nature: "installment", reviewStatus: "auto_categorized", spendingImpact: true, cashflowImpact: true };
  }

  if (input.isSubscription) {
    return { nature: "subscription", reviewStatus: "auto_categorized", spendingImpact: true, cashflowImpact: true };
  }

  return { nature: "expense", reviewStatus: "auto_categorized", spendingImpact: true, cashflowImpact: true };
}
