import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  return NextResponse.json({ ok: true });
}
