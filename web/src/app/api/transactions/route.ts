import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const search = searchParams.get("search");
  const categoryId = searchParams.get("categoryId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const bankName = searchParams.get("bankName");

  const sortBy = searchParams.get("sortBy") ?? "date";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  const SORT_FIELDS: Record<string, Prisma.TransactionOrderByWithRelationInput> = {
    date: { date: sortOrder },
    merchantName: { normalizedMerchant: sortOrder },
    amountArs: { amountArs: sortOrder },
    category: { category: { name: sortOrder } },
  };
  const orderBy = SORT_FIELDS[sortBy] ?? { date: sortOrder };

  const where: Prisma.TransactionWhereInput = {
    deletedAt: null,
    userId: session.userId,
  };

  if (search) {
    where.merchantName = { contains: search };
  }
  if (categoryId) {
    const ids = categoryId.split(",").filter(Boolean);
    where.categoryId = ids.length === 1 ? ids[0] : { in: ids };
  }
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    if (dateTo) (where.date as Prisma.DateTimeFilter).lte = new Date(dateTo);
  }
  if (bankName) {
    where.statement = { bankName };
  }

  const [total, transactions, debitSum, creditSum] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: true,
        statement: { select: { bankName: true, periodEnd: true } },
      },
    }),
    prisma.transaction.aggregate({
      where: { ...where, transactionType: "DEBIT" },
      _sum: { amountArs: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, transactionType: "CREDIT" },
      _sum: { amountArs: true },
    }),
  ]);

  const netTotal = (debitSum._sum.amountArs ?? 0) - (creditSum._sum.amountArs ?? 0);

  return NextResponse.json({ data: transactions, total, page, pageSize: limit, netTotal });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    statementId,
    date,
    merchantName,
    amountArs,
    amountUsd,
    categoryId,
    transactionType,
    isInstallment,
    installmentCurrent,
    installmentTotal,
  } = body as {
    statementId?: string;
    date: string;
    merchantName: string;
    amountArs: number;
    amountUsd?: number;
    categoryId?: string;
    transactionType?: string;
    isInstallment?: boolean;
    installmentCurrent?: number;
    installmentTotal?: number;
  };

  if (!date || !merchantName || amountArs == null) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const tx = await prisma.transaction.create({
    data: {
      statementId: statementId ?? null,
      userId: session.userId,
      date: new Date(date),
      merchantName: merchantName.trim(),
      normalizedMerchant: merchantName.trim().replace(/\s+/g, " "),
      amountArs,
      amountUsd: amountUsd ?? null,
      categoryId: categoryId ?? null,
      source: "MANUAL",
      transactionType: transactionType ?? "DEBIT",
      isInstallment: isInstallment ?? false,
      installmentCurrent: installmentCurrent ?? null,
      installmentTotal: installmentTotal ?? null,
    },
    include: { category: true },
  });

  return NextResponse.json(tx, { status: 201 });
}
