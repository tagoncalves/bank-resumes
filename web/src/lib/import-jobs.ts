import { prisma } from "@/lib/prisma";
import { analyzeStatementWithDeepSeek } from "@/lib/ai/deepseek";
import { extractPdfText } from "@/lib/pdf-parser";
import { readImportJobPdf, readStatementPdf, saveImportJobPdf, saveStatementPdf } from "@/lib/statement-pdf";
import { persistParsedStatement } from "@/lib/statement-import";

type StartAIImportJobInput = {
  userId?: string | null;
  sourceHash: string;
  rawFilename: string;
  pdfBuffer: Buffer;
};

type ExistingStatementReprocessInput = {
  statementId: string;
  userId?: string | null;
  rawFilename: string;
  pdfBuffer: Buffer;
};

export async function createAIImportJob(input: StartAIImportJobInput) {
  const job = await prisma.importJob.create({
    data: {
      userId: input.userId ?? null,
      sourceHash: input.sourceHash,
      rawFilename: input.rawFilename,
      status: "QUEUED",
      importMethod: "AI",
      analysisProvider: "AI",
    },
  });

  saveImportJobPdf(job.id, input.pdfBuffer);
  return job;
}

export async function getImportJobForUser(jobId: string, userId?: string | null) {
  return prisma.importJob.findFirst({
    where: {
      id: jobId,
      ...(userId ? { userId } : { userId: null }),
    },
  });
}

export async function reprocessStatementWithAI(statementId: string) {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    select: {
      id: true,
      userId: true,
      sourceHash: true,
      rawFilename: true,
      importMethod: true,
    },
  });

  if (!statement) {
    throw new Error("No encontrado");
  }

  if (statement.importMethod !== "AI") {
    throw new Error("Solo se puede reprocesar un resumen importado por AI");
  }

  const existingJob = await prisma.importJob.findFirst({
    where: {
      statementId,
      status: { in: ["QUEUED", "ANALYZING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingJob) {
    return existingJob;
  }

  const job = await prisma.importJob.create({
    data: {
      userId: statement.userId ?? null,
      statementId,
      sourceHash: `${statement.sourceHash}:reprocess:${Date.now()}`,
      rawFilename: statement.rawFilename,
      status: "QUEUED",
      importMethod: "AI",
      analysisProvider: "AI",
    },
  });

  saveImportJobPdf(job.id, readStatementPdf(statementId));
  return job;
}

export async function processNextQueuedImportJob() {
  const nextJob = await prisma.importJob.findFirst({
    where: {
      importMethod: "AI",
      status: "QUEUED",
    },
    orderBy: { createdAt: "asc" },
  });

  if (!nextJob) {
    return { processed: false as const };
  }

  const claimed = await prisma.importJob.updateMany({
    where: {
      id: nextJob.id,
      status: "QUEUED",
    },
    data: {
      status: "ANALYZING",
      attemptCount: { increment: 1 },
      lastProcessedAt: new Date(),
      errorMessage: null,
    },
  });

  if (claimed.count === 0) {
    return { processed: false as const };
  }

  try {
    if (nextJob.statementId) {
      await processExistingStatementJob(nextJob.id, {
        statementId: nextJob.statementId,
        userId: nextJob.userId ?? null,
        rawFilename: nextJob.rawFilename,
        pdfBuffer: readImportJobPdf(nextJob.id),
      });
    } else {
      await processNewStatementJob(nextJob.id, {
        userId: nextJob.userId ?? null,
        sourceHash: nextJob.sourceHash,
        rawFilename: nextJob.rawFilename,
        pdfBuffer: readImportJobPdf(nextJob.id),
      });
    }

    return { processed: true as const, jobId: nextJob.id };
  } catch (error) {
    await prisma.importJob.update({
      where: { id: nextJob.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Error al procesar el resumen con AI",
      },
    });

    throw error;
  }
}

async function processNewStatementJob(jobId: string, input: StartAIImportJobInput) {
  const analysis = await runAIAnalysis(jobId, input.rawFilename, input.pdfBuffer);
  const aiParsed = analysis.statement;
  const processingStatus = aiParsed.consistency.passed ? "COMPLETED" : "REVIEW_REQUIRED";

  const statement = await persistParsedStatement(aiParsed, {
    userId: input.userId ?? null,
    sourceHash: input.sourceHash,
    rawFilename: input.rawFilename,
    importMethod: "AI",
    processingStatus,
    analysisProvider: "AI",
    analysisModel: analysis.artifacts.model,
    analysisPromptVersion: analysis.artifacts.prompt_version,
    analysisConfidence: aiParsed.consistency.confidence,
    analysisNotes: aiParsed.consistency.notes,
    analysisStructuredJson: analysis.artifacts.parsed_result_json,
  });

  saveStatementPdf(statement.id, input.pdfBuffer);

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      statementId: statement.id,
      bankName: aiParsed.header.bank_name,
      status: processingStatus,
      analysisProvider: "AI",
      analysisModel: analysis.artifacts.model,
      analysisPromptVersion: analysis.artifacts.prompt_version,
      analysisConfidence: aiParsed.consistency.confidence,
      analysisNotes: aiParsed.consistency.notes.join("\n"),
      sourceTextExcerpt: analysis.artifacts.source_text_excerpt,
      aiRequestPayload: analysis.artifacts.request_payload,
      aiRawResponse: analysis.artifacts.raw_response,
      aiParsedResult: analysis.artifacts.parsed_result_json,
      errorMessage: null,
    },
  });
}

async function processExistingStatementJob(jobId: string, input: ExistingStatementReprocessInput) {
  const analysis = await runAIAnalysis(jobId, input.rawFilename, input.pdfBuffer);
  const aiParsed = analysis.statement;
  const processingStatus = aiParsed.consistency.passed ? "COMPLETED" : "REVIEW_REQUIRED";

  await prisma.statement.update({
    where: { id: input.statementId },
    data: {
      bankName: aiParsed.header.bank_name,
      parserVersion: aiParsed.parser_version,
      analysisProvider: "AI",
      analysisModel: analysis.artifacts.model,
      analysisPromptVersion: analysis.artifacts.prompt_version,
      analysisConfidence: aiParsed.consistency.confidence,
      analysisNotes: aiParsed.consistency.notes.join("\n"),
      analysisStructuredJson: analysis.artifacts.parsed_result_json,
      processingStatus,
      reviewedById: null,
      reviewedAt: null,
      reviewNotes: null,
    },
  });

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      bankName: aiParsed.header.bank_name,
      status: processingStatus,
      analysisProvider: "AI",
      analysisModel: analysis.artifacts.model,
      analysisPromptVersion: analysis.artifacts.prompt_version,
      analysisConfidence: aiParsed.consistency.confidence,
      analysisNotes: aiParsed.consistency.notes.join("\n"),
      sourceTextExcerpt: analysis.artifacts.source_text_excerpt,
      aiRequestPayload: analysis.artifacts.request_payload,
      aiRawResponse: analysis.artifacts.raw_response,
      aiParsedResult: analysis.artifacts.parsed_result_json,
      errorMessage: null,
    },
  });
}

async function runAIAnalysis(jobId: string, filename: string, pdfBuffer: Buffer) {
  const pdfText = await extractPdfText(pdfBuffer);

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      sourceTextExcerpt: pdfText.slice(0, 40000),
    },
  });

  return analyzeStatementWithDeepSeek(pdfText, filename);
}
