import { prisma } from "@/lib/prisma";
import { analyzePayslipWithDeepSeek } from "@/lib/ai/deepseek";
import { extractPdfText } from "@/lib/pdf-parser";
import { money } from "@/lib/money";
import { readPendingPayslipPdf } from "@/lib/statement-pdf";

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
    const pdfBuffer = readPendingPayslipPdf(nextPayslip.id);
    const pdfText = await extractPdfText(pdfBuffer);
    const analysis = await analyzePayslipWithDeepSeek(pdfText, nextPayslip.rawFilename);
    const processingStatus = analysis.payslip.consistency.passed ? "COMPLETED" : "REVIEW_REQUIRED";

    await prisma.$transaction(async (tx) => {
      const salaryCategory = await tx.category.upsert({
        where: { name: "Sueldo" },
        update: {},
        create: {
          name: "Sueldo",
          icon: "💼",
          color: "#10B981",
        },
      });

      const incomeTransaction = await tx.transaction.create({
        data: {
          userId: nextPayslip.userId ?? null,
          date: new Date(analysis.payslip.pay_date),
          merchantName: analysis.payslip.employer_name,
          normalizedMerchant: analysis.payslip.employer_name.replace(/\s+/g, " ").trim(),
          amountArs: money(analysis.payslip.net_amount_ars),
          amountUsd: null,
          categoryId: salaryCategory.id,
          transactionType: "CREDIT",
          source: "IMPORTED",
          isInstallment: false,
        },
      });

      await tx.payslip.update({
        where: { id: nextPayslip.id },
        data: {
          employerName: analysis.payslip.employer_name,
          bankName: null,
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
          incomeTransaction: {
            connect: { id: incomeTransaction.id },
          },
          ...(nextPayslip.userId
            ? {
                user: {
                  connect: { id: nextPayslip.userId },
                },
              }
            : {}),
        },
      });
    });

    return { processed: true as const, payslipId: nextPayslip.id };
  } catch (error) {
    await prisma.payslip.update({
      where: { id: nextPayslip.id },
      data: {
        processingStatus: "FAILED",
        analysisProvider: "AI",
        analysisNotes: error instanceof Error ? error.message : "Error al procesar el recibo con AI",
      },
    });
    throw error;
  }
}
