import { prisma } from "@/lib/prisma";
import { analyzePayslipWithDeepSeek } from "@/lib/ai/deepseek";
import { analyzeWithRetry } from "@/lib/ai/retry";
import { extractPdfText } from "@/lib/pdf-parser";
import { money } from "@/lib/money";
import { ocrImage } from "@/lib/ocr";
import { readPendingPayslipPdf } from "@/lib/statement-pdf";
import { createAiParserFromAnalysis } from "@/lib/ai/parser-generator";
import { isPdfFilename } from "@/lib/parser-training/source-pdf";
import { parseDateOnly } from "@/lib/dates";

function aiConfigured() {
  return !!process.env.DEEPSEEK_API_KEY;
}

export async function processNextQueuedPayslip() {
  if (!aiConfigured()) {
    return { processed: false as const };
  }

  const nextPayslip = await prisma.payslip.findFirst({
    where: {
      processingStatus: "QUEUED",
      analysisProvider: "AI",
      incomeTransactionId: null,
    },
    orderBy: { uploadedAt: "asc" },
  });

  if (!nextPayslip) {
    return { processed: false as const };
  }

  const claimed = await prisma.payslip.updateMany({
    where: {
      id: nextPayslip.id,
      processingStatus: "QUEUED",
    },
    data: {
      processingStatus: "ANALYZING",
      analysisNotes: null,
    },
  });

  if (claimed.count === 0) {
    return { processed: false as const };
  }

  try {
    const pdfBuffer = readPendingPayslipPdf(nextPayslip.id, nextPayslip.rawFilename);
    const pdfText = isPdfFilename(nextPayslip.rawFilename)
      ? await extractPdfText(pdfBuffer)
      : await ocrImage(pdfBuffer);

    const { result: analysis, attempts, errors } = await analyzeWithRetry(
      (previousErrors) => analyzePayslipWithDeepSeek(pdfText, nextPayslip.rawFilename, previousErrors),
    );
    const processingStatus = "PRELIMINARY";

    await prisma.payslip.update({
      where: { id: nextPayslip.id },
      data: {
        employerName: analysis.payslip.employer_name,
        bankName: null,
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
        analysisNotes: [...analysis.payslip.consistency.notes, ...(attempts > 1 ? [`Reintentos: ${attempts}/${5}`] : [])].join("\n") || null,
        analysisStructuredJson: analysis.artifacts.parsed_result_json,
      },
    });

    await createAiParserFromAnalysis({
      sourceType: "PAYSLIP",
      payslipId: nextPayslip.id,
      pdfText,
      rawFilename: nextPayslip.rawFilename,
      employerName: analysis.payslip.employer_name,
      parserFields: analysis.parserFields,
    });

    return { processed: true as const, payslipId: nextPayslip.id };
  } catch (error) {
    const msg = error instanceof AggregateError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Error al procesar el recibo con AI";

    await prisma.payslip.update({
      where: { id: nextPayslip.id },
      data: {
        processingStatus: "FAILED",
        analysisProvider: "AI",
        analysisNotes: msg,
      },
    });
    throw error;
  }
}
