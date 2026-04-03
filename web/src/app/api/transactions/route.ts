import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const search = searchParams.get("search");
  const categoryId = searchParams.get("categoryId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const bankName = searchParams.get("bankName");

  const where: Prisma.TransactionWhereInput = {};

  if (search) {
    where.merchantName = { contains: search };
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    if (dateTo) (where.date as Prisma.DateTimeFilter).lte = new Date(dateTo);
  }
  if (bankName) {
    where.statement = { bankName };
  }

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: true,
        statement: { select: { bankName: true, periodEnd: true } },
      },
    }),
  ]);

  return NextResponse.json({ data: transactions, total, page, pageSize: limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { statementId, date, merchantName, amountArs, amountUsd, categoryId } = body as {
    statementId: string;
    date: string;
    merchantName: string;
    amountArs: number;
    amountUsd?: number;
    categoryId?: string;
  };

  if (!statementId || !date || !merchantName || amountArs == null) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const tx = await prisma.transaction.create({
    data: {
      statementId,
      date: new Date(date),
      merchantName: merchantName.trim(),
      normalizedMerchant: merchantName.trim().replace(/\s+/g, " "),
      amountArs,
      amountUsd: amountUsd ?? null,
      categoryId: categoryId ?? null,
      source: "MANUAL",
      transactionType: "DEBIT",
    },
    include: { category: true },
  });

  return NextResponse.json(tx, { status: 201 });
}
