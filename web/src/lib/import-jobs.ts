import { prisma } from "@/lib/prisma";
import { analyzeStatementWithDeepSeek } from "@/lib/ai/deepseek";
import { analyzeWithRetry } from "@/lib/ai/retry";
import { extractPdfText } from "@/lib/pdf-parser";
import { createStoredFilename, readImportJobPdf, readStatementPdf, saveImportJobPdf, saveStatementPdf } from "@/lib/statement-pdf";
import { persistParsedStatement, createTransactionsFromStoredAnalysis } from "@/lib/statement-import";
import { createAiParserFromAnalysis } from "@/lib/ai/parser-generator";

type StartAIImportJobInput = {
  userId?: string | null;
  sourceHash: string;
  rawFilename: string;
  storedFilename?: string | null;
  pdfBuffer: Buffer;
};

type ExistingStatementReprocessInput = {
  statementId: string;
  userId?: string | null;
  rawFilename: string;
  storedFilename?: string | null;
  pdfBuffer: Buffer;
};

export async function createAIImportJob(input: StartAIImportJobInput) {
  const job = await prisma.importJob.create({
    data: {
      userId: input.userId ?? null,
      sourceHash: input.sourceHash,
      rawFilename: input.rawFilename,
      storedFilename: input.storedFilename ?? null,
      status: "QUEUED",
      importMethod: "AI",
      analysisProvider: "AI",
    },
  });

  saveImportJobPdf(job.id, input.pdfBuffer, job.storedFilename);
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
      storedFilename: true,
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
      storedFilename: createStoredFilename(statement.rawFilename, ".pdf"),
      status: "QUEUED",
      importMethod: "AI",
      analysisProvider: "AI",
    },
  });

  saveImportJobPdf(job.id, readStatementPdf(statementId, statement.storedFilename), job.storedFilename);
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
        storedFilename: nextJob.storedFilename,
        pdfBuffer: readImportJobPdf(nextJob.id, nextJob.storedFilename),
      });
    } else {
      await processNewStatementJob(nextJob.id, {
        userId: nextJob.userId ?? null,
        sourceHash: nextJob.sourceHash,
        rawFilename: nextJob.rawFilename,
        storedFilename: nextJob.storedFilename,
        pdfBuffer: readImportJobPdf(nextJob.id, nextJob.storedFilename),
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
  const processingStatus = "PRELIMINARY";

  const statement = await persistParsedStatement(aiParsed, {
    userId: input.userId ?? null,
    sourceHash: input.sourceHash,
    rawFilename: input.rawFilename,
    storedFilename: createStoredFilename(input.rawFilename, ".pdf"),
    importMethod: "AI",
    processingStatus,
    analysisProvider: "AI",
    analysisModel: analysis.artifacts.model,
    analysisPromptVersion: analysis.artifacts.prompt_version,
    analysisConfidence: aiParsed.consistency.confidence,
    analysisNotes: aiParsed.consistency.notes,
    analysisStructuredJson: analysis.artifacts.parsed_result_json,
  });

  saveStatementPdf(statement.id, input.pdfBuffer, statement.storedFilename);

  // Generate AI parser
  const pdfText = await extractPdfText(input.pdfBuffer);
  await createAiParserFromAnalysis({
    sourceType: "STATEMENT",
    statementId: statement.id,
    pdfText,
    rawFilename: input.rawFilename,
    bankName: aiParsed.header.bank_name,
    parserFields: analysis.parserFields,
  });

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
  const processingStatus = "PRELIMINARY";

  // Delete old transactions from previous analysis (they'll be re-created on confirm)
  await prisma.transaction.deleteMany({
    where: { statementId: input.statementId },
  });

  const pdfText = await extractPdfText(input.pdfBuffer);
  await createAiParserFromAnalysis({
    sourceType: "STATEMENT",
    statementId: input.statementId,
    pdfText,
    rawFilename: input.rawFilename,
    bankName: aiParsed.header.bank_name,
    parserFields: analysis.parserFields,
  });

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

  const { result } = await analyzeWithRetry(
    (previousErrors) => analyzeStatementWithDeepSeek(pdfText, filename, previousErrors),
  );

  return result;
}
