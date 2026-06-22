import type { Prisma } from "@prisma/client";

export async function softDeletePayslipIncomeTransaction(
  db: Prisma.TransactionClient,
  incomeTransactionId: string | null | undefined,
) {
  if (!incomeTransactionId) return;

  await db.transaction.updateMany({
    where: { id: incomeTransactionId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export async function deletePayslipWithIncomeTransaction(
  db: Prisma.TransactionClient,
  payslipId: string,
  incomeTransactionId: string | null | undefined,
) {
  await softDeletePayslipIncomeTransaction(db, incomeTransactionId);
  await db.payslip.delete({ where: { id: payslipId } });
}
