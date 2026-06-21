import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

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
    return NextResponse.json({ error: "La ocurrencia ya creó un movimiento" }, { status: 400 });
  }

  await prisma.recurringTransactionOccurrence.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  return NextResponse.json({ success: true });
}
