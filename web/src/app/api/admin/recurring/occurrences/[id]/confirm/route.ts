import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { createManualTransactionForUser, decimalToNumber } from "@/lib/transactions/create-transaction";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, deny } = await requireAdmin();
  if (deny) return deny;
  const { id } = await params;

  const occurrence = await prisma.recurringTransactionOccurrence.findUnique({
    where: { id },
    include: { recurringTransaction: true },
  });

  if (!occurrence) return NextResponse.json({ error: "Ocurrencia no encontrada" }, { status: 404 });
  if (occurrence.recurringTransaction.userId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (occurrence.transactionId) {
    return NextResponse.json({ success: true, transactionId: occurrence.transactionId });
  }
  if (!["PENDING", "NOTIFIED"].includes(occurrence.status)) {
    return NextResponse.json({ error: "La ocurrencia no se puede confirmar" }, { status: 400 });
  }

  const tx = await createManualTransactionForUser(session.userId, {
    date: occurrence.dueDate,
    merchantName: occurrence.recurringTransaction.merchantName,
    amountArs: decimalToNumber(occurrence.recurringTransaction.amountArs),
    amountUsd: occurrence.recurringTransaction.amountUsd == null ? null : decimalToNumber(occurrence.recurringTransaction.amountUsd),
    categoryId: occurrence.recurringTransaction.categoryId,
    transactionType: occurrence.recurringTransaction.transactionType,
    source: "RECURRENT",
  });

  await prisma.recurringTransactionOccurrence.update({
    where: { id },
    data: { status: "EXECUTED", transactionId: tx.id },
  });

  return NextResponse.json({ success: true, transactionId: tx.id });
}
