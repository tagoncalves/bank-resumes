import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { analyzePayslipWithDeepSeek } from "@/lib/ai/deepseek";
import { analyzeWithRetry } from "@/lib/ai/retry";
import { extractPdfText } from "@/lib/pdf-parser";
import { parsePayslipBuffer } from "@/lib/payslip-parser";
import { money } from "@/lib/money";
import { createAiParserFromAnalysis } from "@/lib/ai/parser-generator";
import { savePayslipPdf } from "@/lib/statement-pdf";
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await guardAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const { action } = await request.json();

  const payslip = await prisma.payslip.findUnique({ where: { id } });
  if (!payslip) return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });

  if (action === "retry") {
    // Clear previous data
    await prisma.$transaction([
      prisma.payslip.update({
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
      }),
      ...(payslip.incomeTransactionId
        ? [prisma.transaction.delete({ where: { id: payslip.incomeTransactionId } })]
        : []),
    ]);

    // Process inline
    try {
      const buffer = readPayslipPdf(id);
      let pdfText: string;

      // Try native parser
      try {
        const parsed = await parsePayslipBuffer(buffer);
        const salaryCategory = await prisma.category.upsert({
          where: { name: "Sueldo" },
          update: {},
          create: { name: "Sueldo", icon: "💼", color: "#10B981" },
        });
        const tx = await prisma.transaction.create({
          data: {
            date: new Date(parsed.payDate),
            merchantName: parsed.employerName,
            normalizedMerchant: parsed.employerName.replace(/\s+/g, " ").trim(),
            amountArs: money(parsed.netAmountArs),
            categoryId: salaryCategory.id,
            transactionType: "CREDIT",
            source: "IMPORTED",
            isInstallment: false,
          },
        });

        await prisma.payslip.update({
          where: { id },
          data: {
            employerName: parsed.employerName,
            bankName: parsed.bankName,
            employeeName: parsed.employeeName,
            periodLabel: parsed.periodLabel,
            payDate: new Date(parsed.payDate),
            netAmount: money(parsed.netAmountArs),
            grossAmount: parsed.grossAmountArs == null ? null : money(parsed.grossAmountArs),
            processingStatus: "COMPLETED",
            incomeTransactionId: tx.id,
          },
        });

        savePayslipPdf(id, buffer);
        return NextResponse.json({ success: true, processingStatus: "COMPLETED", method: "native" });
      } catch {
        // Native failed — try AI
      }

      pdfText = await extractPdfText(buffer);

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
      const salaryCategory = await prisma.category.upsert({
        where: { name: "Sueldo" },
        update: {},
        create: { name: "Sueldo", icon: "💼", color: "#10B981" },
      });

      const tx = await prisma.transaction.create({
        data: {
          date: new Date(analysis.payslip.pay_date),
          merchantName: analysis.payslip.employer_name,
          normalizedMerchant: analysis.payslip.employer_name.replace(/\s+/g, " ").trim(),
          amountArs: money(analysis.payslip.net_amount_ars),
          categoryId: salaryCategory.id,
          transactionType: "CREDIT",
          source: "IMPORTED",
          isInstallment: false,
        },
      });

      const processingStatus = "REVIEW_REQUIRED";

      await prisma.payslip.update({
        where: { id },
        data: {
          employerName: analysis.payslip.employer_name,
          employeeName: analysis.payslip.employee_name,
          periodLabel: analysis.payslip.period_label,
          payDate: new Date(analysis.payslip.pay_date),
          netAmount: money(analysis.payslip.net_amount_ars),
          grossAmount: analysis.payslip.gross_amount_ars == null ? null : money(analysis.payslip.gross_amount_ars),
          processingStatus,
          analysisProvider: "AI",
          analysisModel: analysis.artifacts.model,
          analysisPromptVersion: analysis.artifacts.prompt_version,
          analysisConfidence: analysis.payslip.consistency.confidence,
          analysisNotes: analysis.payslip.consistency.notes.join("\n") || null,
          analysisStructuredJson: analysis.artifacts.parsed_result_json,
          incomeTransactionId: tx.id,
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

      savePayslipPdf(id, buffer);
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
    await prisma.$transaction([
      ...(payslip.incomeTransactionId
        ? [prisma.transaction.delete({ where: { id: payslip.incomeTransactionId } })]
        : []),
      prisma.payslip.delete({ where: { id } }),
    ]);

    for (const dir of [PAYSLIP_DIR, PENDING_DIR]) {
      const filePath = path.join(dir, `${id}.pdf`);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción inválida. Usá 'retry' o 'delete'." }, { status: 400 });
}
