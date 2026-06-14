import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { toMoneyNumber } from "@/lib/money";

export async function GET() {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const statements = await prisma.statement.findMany({
    where: {
      importMethod: "AI",
      processingStatus: { in: ["REVIEW_REQUIRED", "REJECTED", "COMPLETED"] },
    },
    orderBy: [
      { processingStatus: "asc" },
      { uploadedAt: "desc" },
    ],
    include: {
      card: true,
      balanceSummary: true,
      reviewedBy: { select: { username: true, displayName: true } },
      importJobs: {
        where: { importMethod: "AI" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { transactions: true } },
    },
  });

  return NextResponse.json(
    statements.map((statement) => {
      const latestJob = statement.importJobs[0] ?? null;

      return {
        id: statement.id,
        bankName: statement.bankName,
        holderName: statement.card.holderName,
        cardLastFour: statement.card.lastFour,
        cardNetwork: statement.card.cardNetwork,
        periodEnd: statement.periodEnd,
        dueDate: statement.dueDate,
        uploadedAt: statement.uploadedAt,
        processingStatus: statement.processingStatus,
        analysisProvider: statement.analysisProvider,
        analysisModel: statement.analysisModel,
        analysisPromptVersion: statement.analysisPromptVersion,
        analysisConfidence: statement.analysisConfidence,
        analysisNotes: statement.analysisNotes,
        analysisStructuredJson: statement.analysisStructuredJson,
        sourceTextExcerpt: latestJob?.sourceTextExcerpt ?? null,
        aiRequestPayload: latestJob?.aiRequestPayload ?? null,
        aiRawResponse: latestJob?.aiRawResponse ?? null,
        latestJobId: latestJob?.id ?? null,
        latestJobStatus: latestJob?.status ?? null,
        latestJobAttempts: latestJob?.attemptCount ?? 0,
        latestJobLastProcessedAt: latestJob?.lastProcessedAt ?? null,
        reviewNotes: statement.reviewNotes,
        reviewedAt: statement.reviewedAt,
        reviewedBy: statement.reviewedBy
          ? statement.reviewedBy.displayName ?? statement.reviewedBy.username
          : null,
        transactionCount: statement._count.transactions,
        currentBalance: toMoneyNumber(statement.balanceSummary?.currentBalance),
      };
    })
  );
}
