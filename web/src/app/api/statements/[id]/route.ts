import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "statements");

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const statement = await prisma.statement.findUnique({
    where: { id: params.id },
    include: {
      card: { include: { bank: true } },
      balanceSummary: true,
      transactions: {
        include: { category: true },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!statement) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(statement);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.statement.delete({ where: { id: params.id } });
  try { fs.unlinkSync(path.join(UPLOADS_DIR, `${params.id}.pdf`)); } catch { /* non-fatal */ }
  return NextResponse.json({ ok: true });
}
