import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const existing = await prisma.transaction.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const body = await req.json();
  const {
    categoryId,
    date,
    merchantName,
    amountArs,
    amountUsd,
    transactionType,
    isInstallment,
    installmentCurrent,
    installmentTotal,
  } = body as {
    categoryId?: string | null;
    date?: string;
    merchantName?: string;
    amountArs?: number;
    amountUsd?: number | null;
    transactionType?: string;
    isInstallment?: boolean;
    installmentCurrent?: number | null;
    installmentTotal?: number | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (categoryId !== undefined) data.categoryId = categoryId;
  if (date !== undefined) data.date = new Date(date);
  if (merchantName !== undefined) {
    data.merchantName = merchantName.trim();
    data.normalizedMerchant = merchantName.trim().replace(/\s+/g, " ");
  }
  if (amountArs !== undefined) data.amountArs = amountArs;
  if (amountUsd !== undefined) data.amountUsd = amountUsd;
  if (transactionType !== undefined) data.transactionType = transactionType;
  if (isInstallment !== undefined) data.isInstallment = isInstallment;
  if (installmentCurrent !== undefined) data.installmentCurrent = installmentCurrent;
  if (installmentTotal !== undefined) data.installmentTotal = installmentTotal;

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data,
    include: { category: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const existing = await prisma.transaction.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  await prisma.transaction.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
