import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { analyzePayslipWithDeepSeek } from "@/lib/ai/deepseek";
import { getSession } from "@/lib/auth";
import { money, toMoneyNumber } from "@/lib/money";
import { extractPdfText } from "@/lib/pdf-parser";
import { parsePayslipBuffer } from "@/lib/payslip-parser";
import { ocrImage } from "@/lib/ocr";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { createStoredFilename, savePendingPayslipPdf, savePayslipPdf } from "@/lib/statement-pdf";
import { createAiParserFromAnalysis, findMatchingAiParsers } from "@/lib/ai/parser-generator";
import { isPdfFilename } from "@/lib/parser-training/source-pdf";
import { parseDateOnly } from "@/lib/dates";

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isSupportedPayslipFile(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return true;
  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp")) return true;
  return SUPPORTED_IMAGE_TYPES.has(file.type);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const ip = getClientIp(req);
    const rateLimit = enforceRateLimit({
      key: `payslip-upload:${ip}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Demasiadas cargas recientes. Intentá nuevamente en unos minutos." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !isSupportedPayslipFile(file)) {
      return NextResponse.json({ error: "Se requiere un archivo PDF o imagen (PNG/JPG/WEBP)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const userWhere = { userId: session.userId };
    const storedFilename = createStoredFilename(file.name);

    const existing = await prisma.payslip.findFirst({ where: { ...userWhere, sourceHash: hash } });
    if (existing) {
      return NextResponse.json(
        {
          error: "DUPLICATE_PAYSLIP",
          existingPayslipId: existing.id,
          processingStatus: existing.processingStatus,
        },
        { status: 409 }
      );
    }

    const mode = formData.get("mode") as string | null;
    const isPdf = isPdfFilename(file.name);

    // Manual import with user-provided data
    if (mode === "manual") {
      const employerName = formData.get("employerName") as string | null;
      const periodLabel = formData.get("periodLabel") as string | null;
      const payDate = formData.get("payDate") as string | null;
      const netAmount = formData.get("netAmount") as string | null;
      const currency = (formData.get("currency") as string | null) || "ARS";

      if (!employerName || !periodLabel || !payDate || !netAmount) {
        return NextResponse.json({ error: "Faltan datos requeridos: empleador, período, fecha de cobro, sueldo neto" }, { status: 400 });
      }

      const netAmountNum = parseFloat(netAmount);
      if (isNaN(netAmountNum) || netAmountNum <= 0) {
        return NextResponse.json({ error: "El sueldo neto debe ser un número positivo" }, { status: 400 });
      }

      const salaryCategory = await prisma.category.upsert({
        where: { name: "Sueldo" },
        update: {},
        create: { name: "Sueldo", icon: "💼", color: "#10B981" },
      });

      const created = await prisma.$transaction(async (tx) => {
        const incomeTransaction = await tx.transaction.create({
          data: {
            userId: session.userId,
            date: parseDateOnly(payDate),
            merchantName: employerName,
            normalizedMerchant: employerName.replace(/\s+/g, " ").trim(),
            amountArs: money(netAmountNum),
            amountUsd: currency === "USD" ? money(netAmountNum) : null,
            categoryId: salaryCategory.id,
            transactionType: "CREDIT",
            nature: "income",
            reviewStatus: "auto_categorized",
            spendingImpact: false,
            cashflowImpact: true,
            source: "IMPORTED",
            isInstallment: false,
          },
        });

        const payslip = await tx.payslip.create({
          data: {
            rawFilename: file.name,
            storedFilename,
            sourceHash: hash,
            employerName,
            periodLabel,
            payDate: parseDateOnly(payDate),
            netAmount: money(netAmountNum),
            currency,
            processingStatus: "COMPLETED",
            incomeTransactionId: incomeTransaction.id,
            analysisProvider: "MANUAL",
            userId: session.userId,
          },
        });

        return { payslip, incomeTransaction };
      });

      savePayslipPdf(created.payslip.id, buffer, file.name, storedFilename);

      return NextResponse.json(
        {
          payslipId: created.payslip.id,
          rawFilename: created.payslip.rawFilename,
          employerName: created.payslip.employerName,
          periodLabel: created.payslip.periodLabel,
          amountArs: toMoneyNumber(created.payslip.netAmount),
          currency: created.payslip.currency,
          processingStatus: "COMPLETED",
          importMethod: "MANUAL",
          transactionId: created.incomeTransaction.id,
        },
        { status: 201 }
      );
    }

    // AI queue — save file and enqueue for background processing
    if (mode === "ai") {
      const queuedPayslip = await prisma.payslip.create({
        data: {
          rawFilename: file.name,
          storedFilename,
          sourceHash: hash,
          processingStatus: "QUEUED",
          analysisProvider: "AI",
          user: { connect: { id: session.userId } },
        },
      });
      savePendingPayslipPdf(queuedPayslip.id, buffer, file.name, storedFilename);

      return NextResponse.json(
        {
          payslipId: queuedPayslip.id,
          processingStatus: "QUEUED",
          importMethod: "AI",
          message: process.env.DEEPSEEK_API_KEY
            ? "Recibo enviado a análisis AI en segundo plano."
            : "Recibo guardado para análisis AI pendiente de integración.",
        },
        { status: 202 }
      );
    }

    // Original automatic flow: native parser → AI match → DeepSeek
    let mappedPayslip:
      | {
          bankName?: string;
          employerName: string;
          employeeName: string;
          periodLabel: string;
          payDate: string;
          netAmountArs: number;
          grossAmountArs?: number;
          processingStatus: "COMPLETED" | "PRELIMINARY";
          analysisProvider: string | null;
          analysisModel: string | null;
          analysisPromptVersion: string | null;
          analysisConfidence: number | null;
          analysisNotes: string | null;
          analysisStructuredJson: string | null;
        };

    try {
      if (!isPdf) {
        throw new Error("Native PDF parser not applicable");
      }

      const parsed = await parsePayslipBuffer(buffer);
      mappedPayslip = {
        employerName: parsed.employerName,
        bankName: parsed.bankName,
        employeeName: parsed.employeeName,
        periodLabel: parsed.periodLabel,
        payDate: parsed.payDate,
        netAmountArs: parsed.netAmountArs,
        grossAmountArs: parsed.grossAmountArs,
        processingStatus: "COMPLETED",
        analysisProvider: null,
        analysisModel: null,
        analysisPromptVersion: null,
        analysisConfidence: null,
        analysisNotes: null,
        analysisStructuredJson: null,
      };
    } catch {
      const extractedText = isPdf ? await extractPdfText(buffer) : await ocrImage(buffer);

      // Try matching AI-generated parsers first
      const matches = await findMatchingAiParsers(extractedText, "PAYSLIP");
      if (matches.length > 0) {
        const queuedPayslip = await prisma.payslip.create({
          data: {
            rawFilename: file.name,
            storedFilename,
            sourceHash: hash,
            processingStatus: "QUEUED",
            analysisProvider: "AI",
            user: { connect: { id: session.userId } },
          },
        });
        savePendingPayslipPdf(queuedPayslip.id, buffer, file.name, storedFilename);
        return NextResponse.json(
          {
            payslipId: queuedPayslip.id,
            processingStatus: "QUEUED",
            importMethod: "AI",
            message: `Se encontró un parser AI similar (${matches[0].employerName ?? matches[0].id}). El recibo se procesará en segundo plano.`,
          },
          { status: 202 }
        );
      }

      try {
          const analysis = await analyzePayslipWithDeepSeek(extractedText, file.name);

        // Generate parser from successful analysis
        await createAiParserFromAnalysis({
          sourceType: "PAYSLIP",
            pdfText: extractedText,
            rawFilename: file.name,
          employerName: analysis.payslip.employer_name,
          parserFields: analysis.parserFields,
        });

        mappedPayslip = {
          employerName: analysis.payslip.employer_name,
          bankName: undefined,
          employeeName: analysis.payslip.employee_name,
          periodLabel: analysis.payslip.period_label,
          payDate: analysis.payslip.pay_date,
          netAmountArs: analysis.payslip.net_amount_ars,
          grossAmountArs: analysis.payslip.gross_amount_ars,
          processingStatus: "PRELIMINARY",
          analysisProvider: "AI",
          analysisModel: analysis.artifacts.model,
          analysisPromptVersion: analysis.artifacts.prompt_version,
          analysisConfidence: analysis.payslip.consistency.confidence,
          analysisNotes: analysis.payslip.consistency.notes.join("\n") || null,
          analysisStructuredJson: analysis.artifacts.parsed_result_json,
        };
      } catch {
        const queuedPayslip = await prisma.payslip.create({
          data: {
            rawFilename: file.name,
            storedFilename,
            sourceHash: hash,
            processingStatus: "QUEUED",
            analysisProvider: "AI",
            user: { connect: { id: session.userId } },
          },
        });

        savePendingPayslipPdf(queuedPayslip.id, buffer, file.name, storedFilename);

        return NextResponse.json(
          {
            payslipId: queuedPayslip.id,
            processingStatus: "QUEUED",
            importMethod: "AI",
            message: process.env.DEEPSEEK_API_KEY
              ? "Recibo guardado para análisis AI en segundo plano. El ingreso se generará automáticamente al terminar el procesamiento."
              : "Recibo guardado para análisis AI pendiente de integración. Se procesará automáticamente cuando AI esté configurada.",
          },
          { status: 202 }
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      let incomeTransactionId: string | undefined;

      // Only create income transaction for COMPLETED status (native parse)
      if (mappedPayslip.processingStatus === "COMPLETED") {
        const salaryCategory = await tx.category.upsert({
          where: { name: "Sueldo" },
          update: {},
          create: { name: "Sueldo", icon: "💼", color: "#10B981" },
        });

        const incomeTransaction = await tx.transaction.create({
          data: {
            userId: session.userId,
            date: parseDateOnly(mappedPayslip.payDate),
            merchantName: mappedPayslip.employerName,
            normalizedMerchant: mappedPayslip.employerName.replace(/\s+/g, " ").trim(),
            amountArs: money(mappedPayslip.netAmountArs),
            amountUsd: null,
            categoryId: salaryCategory.id,
            transactionType: "CREDIT",
            nature: "income",
            reviewStatus: "auto_categorized",
            spendingImpact: false,
            cashflowImpact: true,
            source: "IMPORTED",
            isInstallment: false,
          },
        });
        incomeTransactionId = incomeTransaction.id;
      }

      const payslip = await tx.payslip.create({
        data: {
          rawFilename: file.name,
          storedFilename,
          sourceHash: hash,
          employerName: mappedPayslip.employerName,
          bankName: mappedPayslip.bankName,
          employeeName: mappedPayslip.employeeName,
          periodLabel: mappedPayslip.periodLabel,
          payDate: parseDateOnly(mappedPayslip.payDate),
          netAmount: money(mappedPayslip.netAmountArs),
          grossAmount: mappedPayslip.grossAmountArs == null ? null : money(mappedPayslip.grossAmountArs),
          processingStatus: mappedPayslip.processingStatus,
          analysisProvider: mappedPayslip.analysisProvider,
          analysisModel: mappedPayslip.analysisModel,
          analysisPromptVersion: mappedPayslip.analysisPromptVersion,
          analysisConfidence: mappedPayslip.analysisConfidence,
          analysisNotes: mappedPayslip.analysisNotes,
          analysisStructuredJson: mappedPayslip.analysisStructuredJson,
          user: { connect: { id: session.userId } },
          ...(incomeTransactionId
            ? { incomeTransaction: { connect: { id: incomeTransactionId } } }
            : {}),
        },
      });

      return { payslip, incomeTransactionId };
    });

    savePayslipPdf(created.payslip.id, buffer, file.name, storedFilename);

    const responseData: Record<string, unknown> = {
      payslipId: created.payslip.id,
      rawFilename: created.payslip.rawFilename,
      uploadedAt: created.payslip.uploadedAt,
      employerName: created.payslip.employerName,
      bankName: created.payslip.bankName,
      employeeName: created.payslip.employeeName,
      periodLabel: created.payslip.periodLabel,
      amountArs: toMoneyNumber(created.payslip.netAmount),
      processingStatus: created.payslip.processingStatus,
      analysisConfidence: created.payslip.analysisConfidence,
      importMethod: created.payslip.analysisProvider ? "AI" : "MANUAL",
    };

    if (created.incomeTransactionId) {
      responseData.transactionId = created.incomeTransactionId;
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado al cargar el recibo" },
      { status: 500 }
    );
  }
}
