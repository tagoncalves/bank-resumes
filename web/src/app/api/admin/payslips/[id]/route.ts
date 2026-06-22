import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { analyzePayslipWithDeepSeek } from "@/lib/ai/deepseek";
import { analyzeWithRetry } from "@/lib/ai/retry";
import { extractPdfText } from "@/lib/pdf-parser";
import { parsePayslipBuffer } from "@/lib/payslip-parser";
import { money } from "@/lib/money";
import { ocrImage } from "@/lib/ocr";
import { createAiParserFromAnalysis, deleteAiParsersForSource } from "@/lib/ai/parser-generator";
import { deletePayslipWithIncomeTransaction, softDeletePayslipIncomeTransaction } from "@/lib/payslips/delete";
import { readPayslipPdf as readStoredPayslipFile, savePayslipPdf } from "@/lib/statement-pdf";
import { isPdfFilename } from "@/lib/parser-training/source-pdf";
import { parseDateOnly } from "@/lib/dates";
import fs from "fs";
import path from "path";

const PAYSLIP_DIR = path.join(process.cwd(), "uploads", "payslips");
const PENDING_DIR = path.join(PAYSLIP_DIR, "pending");

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return session;
}

function readPayslipPdf(id: string): Buffer {
  for (const dir of [PAYSLIP_DIR, PENDING_DIR]) {
    const filePath = path.join(dir, `${id}.pdf`);
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
  }
  throw new Error("PDF no encontrado para este recibo");
}

function deletePayslipFiles(id: string) {
  const extensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
  for (const dir of [PAYSLIP_DIR, PENDING_DIR]) {
    for (const ext of extensions) {
      const filePath = path.join(dir, `${id}${ext}`);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
  }
}

async function createIncomeTransaction(
  employerName: string,
  payDate: string,
  netAmountArs: number,
  userId: string | null,
) {
  const salaryCategory = await prisma.category.upsert({
    where: { name: "Sueldo" },
    update: {},
    create: { name: "Sueldo", icon: "💼", color: "#10B981" },
  });

  return prisma.transaction.create({
    data: {
      userId: userId ?? null,
      date: parseDateOnly(payDate),
      merchantName: employerName,
      normalizedMerchant: employerName.replace(/\s+/g, " ").trim(),
      amountArs: money(netAmountArs),
      categoryId: salaryCategory.id,
      transactionType: "CREDIT",
      source: "IMPORTED",
      isInstallment: false,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await guardAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const { action } = await request.json();

  const payslip = await prisma.payslip.findUnique({ where: { id } });
  if (!payslip) return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });

  if (action === "confirm") {
    if (payslip.processingStatus !== "PRELIMINARY") {
      return NextResponse.json({ error: "Solo se pueden confirmar recibos en estado preliminar" }, { status: 400 });
    }

    // Parse stored analysis JSON to create the income transaction
    if (!payslip.analysisStructuredJson) {
      return NextResponse.json({ error: "No hay análisis almacenado para confirmar" }, { status: 400 });
    }

    let analysisData: { payslip: { employer_name: string; pay_date: string; net_amount_ars: number } };
    try {
      analysisData = JSON.parse(payslip.analysisStructuredJson);
    } catch {
      return NextResponse.json({ error: "El análisis almacenado no es JSON válido" }, { status: 400 });
    }

    const tx = await createIncomeTransaction(
      analysisData.payslip.employer_name,
      analysisData.payslip.pay_date,
      analysisData.payslip.net_amount_ars,
      payslip.userId,
    );

    await prisma.payslip.update({
      where: { id },
      data: {
        processingStatus: "COMPLETED",
        incomeTransactionId: tx.id,
      },
    });

    return NextResponse.json({ success: true, processingStatus: "COMPLETED" });
  }

  if (action === "clear-analysis") {
    // Clear AI analysis data without re-queuing (keep payslip with manual/raw data)
    await prisma.payslip.update({
      where: { id },
      data: {
        analysisProvider: null,
        analysisModel: null,
        analysisPromptVersion: null,
        analysisConfidence: null,
        analysisNotes: null,
        analysisStructuredJson: null,
        employerName: payslip.analysisProvider === "AI" ? null : payslip.employerName,
        employeeName: payslip.analysisProvider === "AI" ? null : payslip.employeeName,
        periodLabel: payslip.analysisProvider === "AI" ? null : payslip.periodLabel,
        payDate: payslip.analysisProvider === "AI" ? null : payslip.payDate,
        netAmount: payslip.analysisProvider === "AI" ? null : payslip.netAmount,
        grossAmount: payslip.analysisProvider === "AI" ? null : payslip.grossAmount,
        processingStatus: payslip.incomeTransactionId ? "COMPLETED" : "QUEUED",
      },
    });

    await deleteAiParsersForSource("PAYSLIP", id);

    return NextResponse.json({ success: true, processingStatus: payslip.incomeTransactionId ? "COMPLETED" : "QUEUED" });
  }

  if (action === "reject") {
    if (payslip.processingStatus !== "PRELIMINARY") {
      return NextResponse.json({ error: "Solo se pueden rechazar recibos en estado preliminar" }, { status: 400 });
    }

    // Clear all analysis data and set back to QUEUED for re-analysis
    await prisma.payslip.update({
      where: { id },
      data: {
        processingStatus: "QUEUED",
        analysisProvider: "AI",
        analysisModel: null,
        analysisPromptVersion: null,
        analysisConfidence: null,
        analysisNotes: null,
        analysisStructuredJson: null,
        employerName: null,
        employeeName: null,
        periodLabel: null,
        payDate: null,
        netAmount: null,
        grossAmount: null,
      },
    });

    // Clean up old AI parsers so they can be regenerated
    await deleteAiParsersForSource("PAYSLIP", id);

    return NextResponse.json({ success: true, processingStatus: "QUEUED" });
  }

  if (action === "retry") {
    // Clear previous data and remove any income transaction linked to the previous analysis.
    await prisma.$transaction(async (tx) => {
      await softDeletePayslipIncomeTransaction(tx, payslip.incomeTransactionId);
      await tx.payslip.update({
        where: { id },
        data: {
          processingStatus: "ANALYZING",
          analysisProvider: "AI",
          analysisModel: null,
          analysisPromptVersion: null,
          analysisConfidence: null,
          analysisNotes: null,
          analysisStructuredJson: null,
          employerName: null,
          employeeName: null,
          periodLabel: null,
          payDate: null,
          netAmount: null,
          grossAmount: null,
          incomeTransactionId: null,
        },
      });
    });

    // Clean up old AI parsers
    await deleteAiParsersForSource("PAYSLIP", id);

    // Process inline
    try {
      const buffer = readStoredPayslipFile(id, payslip.rawFilename);
      let pdfText: string;

      // Try native parser
      try {
        if (!isPdfFilename(payslip.rawFilename)) {
          throw new Error("Native PDF parser not applicable");
        }
        const parsed = await parsePayslipBuffer(buffer);
        const tx = await createIncomeTransaction(
          parsed.employerName,
          parsed.payDate,
          parsed.netAmountArs,
          payslip.userId,
        );

        await prisma.payslip.update({
          where: { id },
          data: {
            employerName: parsed.employerName,
            bankName: parsed.bankName,
            employeeName: parsed.employeeName,
            periodLabel: parsed.periodLabel,
            payDate: parseDateOnly(parsed.payDate),
            netAmount: money(parsed.netAmountArs),
            grossAmount: parsed.grossAmountArs == null ? null : money(parsed.grossAmountArs),
            processingStatus: "COMPLETED",
            incomeTransactionId: tx.id,
          },
        });

        savePayslipPdf(id, buffer, payslip.rawFilename);
        return NextResponse.json({ success: true, processingStatus: "COMPLETED", method: "native" });
      } catch {
        // Native failed — try AI
      }

      pdfText = isPdfFilename(payslip.rawFilename) ? await extractPdfText(buffer) : await ocrImage(buffer);

      if (!process.env.DEEPSEEK_API_KEY) {
        await prisma.payslip.update({
          where: { id },
          data: {
            processingStatus: "QUEUED",
            analysisNotes: "AI no está configurada. Definí DEEPSEEK_API_KEY para procesar recibos no mapeados.",
          },
        });
        return NextResponse.json({ success: true, processingStatus: "QUEUED", message: "Sin API key de AI. El recibo queda en cola." });
      }

      const previousErrors = payslip.analysisNotes ? [payslip.analysisNotes] : undefined;
      const { result: analysis } = await analyzeWithRetry(
        (prev) => analyzePayslipWithDeepSeek(pdfText, payslip.rawFilename, [...(previousErrors ?? []), ...prev]),
      );
      const processingStatus = "PRELIMINARY";

      await prisma.payslip.update({
        where: { id },
        data: {
          employerName: analysis.payslip.employer_name,
          employeeName: analysis.payslip.employee_name,
          periodLabel: analysis.payslip.period_label,
          payDate: parseDateOnly(analysis.payslip.pay_date),
          netAmount: money(analysis.payslip.net_amount_ars),
          grossAmount: analysis.payslip.gross_amount_ars == null ? null : money(analysis.payslip.gross_amount_ars),
          processingStatus,
          analysisProvider: "AI",
          analysisModel: analysis.artifacts.model,
          analysisPromptVersion: analysis.artifacts.prompt_version,
          analysisConfidence: analysis.payslip.consistency.confidence,
          analysisNotes: analysis.payslip.consistency.notes.join("\n") || null,
          analysisStructuredJson: analysis.artifacts.parsed_result_json,
          incomeTransactionId: null,
        },
      });

      // Generate parser from this analysis
      await createAiParserFromAnalysis({
        sourceType: "PAYSLIP",
        payslipId: id,
        pdfText,
        rawFilename: payslip.rawFilename,
        employerName: analysis.payslip.employer_name,
        parserFields: analysis.parserFields,
      });

      savePayslipPdf(id, buffer, payslip.rawFilename);
      return NextResponse.json({ success: true, processingStatus, method: "ai" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al reprocesar";
      await prisma.payslip.update({
        where: { id },
        data: { processingStatus: "FAILED", analysisNotes: msg },
      });
      return NextResponse.json({ success: false, error: msg, processingStatus: "FAILED" });
    }
  }

  if (action === "delete") {
    // Clean up old AI parsers first
    await deleteAiParsersForSource("PAYSLIP", id);

    await prisma.$transaction((tx) => deletePayslipWithIncomeTransaction(tx, id, payslip.incomeTransactionId));

    deletePayslipFiles(id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción inválida. Usá 'confirm', 'reject', 'retry' o 'delete'." }, { status: 400 });
}
