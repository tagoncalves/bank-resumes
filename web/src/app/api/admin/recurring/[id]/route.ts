import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { id } = await params;
  const body = await request.json();

  const updated = await prisma.recurringTransaction.update({
    where: { id },
    data: {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      requiresConfirmation: typeof body.requiresConfirmation === "boolean" ? body.requiresConfirmation : undefined,
      reminderDaysBefore: body.reminderDaysBefore == null ? undefined : Number(body.reminderDaysBefore),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { id } = await params;
  await prisma.recurringTransaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
