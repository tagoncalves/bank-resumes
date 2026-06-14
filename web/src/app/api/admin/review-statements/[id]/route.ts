import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { reprocessStatementWithAI } from "@/lib/import-jobs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { session, deny } = await requireAdmin();
  if (deny || !session) return deny;

  const { action, reviewNotes } = await req.json() as {
    action?: "approve" | "reject" | "reprocess";
    reviewNotes?: string;
  };

  if (action !== "approve" && action !== "reject" && action !== "reprocess") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const existing = await prisma.statement.findUnique({
    where: { id },
    select: { id: true, importMethod: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (existing.importMethod !== "AI") {
    return NextResponse.json({ error: "Solo se pueden revisar manualmente resúmenes importados por AI" }, { status: 400 });
  }

  if (action === "reprocess") {
    const job = await reprocessStatementWithAI(id);
    return NextResponse.json({
      ok: true,
      jobId: job.id,
      processingStatus: "ANALYZING",
    });
  }

  const updated = await prisma.statement.update({
    where: { id },
    data: {
      processingStatus: action === "approve" ? "COMPLETED" : "REJECTED",
      reviewedById: session.userId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes?.trim() || null,
    },
    include: {
      reviewedBy: { select: { username: true, displayName: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    processingStatus: updated.processingStatus,
    reviewNotes: updated.reviewNotes,
    reviewedAt: updated.reviewedAt,
    reviewedBy: updated.reviewedBy
      ? updated.reviewedBy.displayName ?? updated.reviewedBy.username
      : null,
  });
}
