import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { parseStatementBuffer } from "@/lib/pdf-parser";
import { categorizeTransaction } from "@/lib/categorizer";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Se requiere un archivo PDF" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Duplicate check
  const existing = await prisma.statement.findUnique({ where: { sourceHash: hash } });
  if (existing) {
    return NextResponse.json(
      { error: "DUPLICATE_STATEMENT", existingStatementId: existing.id },
      { status: 409 }
    );
  }

  // Parse PDF (JS parser — no external service needed)
  let parsed;
  try {
    parsed = await parseStatementBuffer(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al parsear el PDF";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const { header, balance_summary, transactions } = parsed;

  // Upsert Bank
  const bank = await prisma.bank.upsert({
    where: { name: header.bank_name },
    update: {},
    create: { name: header.bank_name },
  });

  // Upsert Card
  const card = await prisma.card.upsert({
    where: { bankId_lastFour: { bankId: bank.id, lastFour: header.card_last_four } },
    update: { holderName: header.holder_name },
    create: {
      bankId: bank.id,
      lastFour: header.card_last_four,
      cardNetwork: header.card_network,
      holderName: header.holder_name,
      accountNumber: header.account_number,
    },
  });

  // Load categories
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

  // Persist everything in one transaction
  const statement = await prisma.$transaction(async (tx) => {
    const stmt = await tx.statement.create({
      data: {
        cardId: card.id,
        bankName: header.bank_name,
        periodStart: new Date(header.period_start),
        periodEnd: new Date(header.period_end),
        dueDate: new Date(header.due_date),
        rawFilename: file.name,
        sourceHash: hash,
      },
    });

    await tx.balanceSummary.create({
      data: {
        statementId: stmt.id,
        previousBalance:       balance_summary.previous_balance,
        previousBalanceUsd:    balance_summary.previous_balance_usd,
        paymentsApplied:       balance_summary.payments_applied,
        totalConsumption:      balance_summary.total_consumption,
        commissionCuentaFull:  balance_summary.commission_cuenta_full,
        selloTax:              balance_summary.sello_tax,
        ivaTax:                balance_summary.iva_tax,
        iibbTax:               balance_summary.iibb_tax,
        financingInterest:     balance_summary.financing_interest,
        currentBalance:        balance_summary.current_balance,
        currentBalanceUsd:     balance_summary.current_balance_usd,
        minimumPayment:        balance_summary.minimum_payment,
        tnaArs:                balance_summary.tna_ars,
        temArs:                balance_summary.tem_ars,
        teaArs:                balance_summary.tea_ars,
        tnaUsd:                balance_summary.tna_usd,
        temUsd:                balance_summary.tem_usd,
        teaUsd:                balance_summary.tea_usd,
      },
    });

    for (const t of transactions) {
      const categoryName = categorizeTransaction(t.merchant_name);
      const categoryId = categoryMap.get(categoryName) ?? categoryMap.get("Otros");
      const isInstallment = !!(t.installment_current && t.installment_total);

      await tx.transaction.create({
        data: {
          statementId:       stmt.id,
          categoryId:        categoryId ?? null,
          date:              new Date(t.date),
          merchantName:      t.merchant_name,
          normalizedMerchant:t.merchant_name.trim().replace(/\s+/g, " "),
          voucherNumber:     t.voucher_number,
          installmentCurrent:t.installment_current,
          installmentTotal:  t.installment_total,
          amountArs:         t.amount_ars,
          amountUsd:         t.amount_usd,
          cardLastFour:      t.card_last_four,
          isInstallment,
        },
      });
    }

    return stmt;
  });

  return NextResponse.json(
    {
      statementId: statement.id,
      bank: header.bank_name,
      periodEnd: header.period_end,
      transactionCount: transactions.length,
    },
    { status: 201 }
  );
}
