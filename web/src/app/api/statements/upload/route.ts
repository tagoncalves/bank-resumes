import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { parseStatementBuffer } from "@/lib/pdf-parser";
import { getSession } from "@/lib/auth";
import { createAIImportJob } from "@/lib/import-jobs";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { saveStatementPdf } from "@/lib/statement-pdf";
import { persistParsedStatement } from "@/lib/statement-import";
import { extractPdfText } from "@/lib/pdf-parser";
import { findMatchingAiParsers } from "@/lib/ai/parser-generator";

function isUnsupportedBankError(error: unknown) {
  return error instanceof Error && error.message.includes("Banco no reconocido");
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const ip = getClientIp(req);
  const rateLimit = enforceRateLimit({
    key: `statement-upload:${ip}`,
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

  const existingJob = await prisma.importJob.findUnique({ where: { sourceHash: hash } });
  if (existingJob) {
    return NextResponse.json(
      {
        error: "DUPLICATE_IMPORT_JOB",
        jobId: existingJob.id,
        statementId: existingJob.statementId,
        processingStatus: existingJob.status,
      },
      { status: 409 }
    );
  }

  let parsed;

  try {
    parsed = await parseStatementBuffer(buffer);
  } catch (err) {
    if (!isUnsupportedBankError(err)) {
      const msg = err instanceof Error ? err.message : "Error al parsear el PDF";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    // Try matching AI-generated parsers first
    const pdfText = await extractPdfText(buffer);
    const matches = await findMatchingAiParsers(pdfText, "STATEMENT");
    if (matches.length > 0) {
      return NextResponse.json(
        {
          message: "Se encontró un parser generado por AI para este formato. Usá la opción de reprocesar desde la bandeja de revisión.",
          matchedParsers: matches.map((m) => ({ id: m.id, bankName: m.bankName })),
        },
        { status: 202 }
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Banco no reconocido por el parser nativo y AI no está configurada. Definí DEEPSEEK_API_KEY para habilitar el mapeo asistido por AI." },
        { status: 422 }
      );
    }

    const job = await createAIImportJob({
      userId: session?.userId ?? null,
      sourceHash: hash,
      rawFilename: file.name,
      pdfBuffer: buffer,
    });

    return NextResponse.json(
      {
        jobId: job.id,
        importMethod: "AI",
        processingStatus: "QUEUED",
        message: "Resumen enviado a la cola de análisis AI. El mapeo se procesará automáticamente.",
      },
      { status: 202 }
    );
  }

  const importMethod: "NATIVE" | "AI" = "NATIVE";
  const processingStatus: "COMPLETED" | "PRELIMINARY" = "COMPLETED";
  const analysisProvider: string | null = null;
  const analysisConfidence: number | null = null;
  const analysisNotes: string[] = [];

  const statement = await persistParsedStatement(parsed, {
    userId: session?.userId ?? null,
    sourceHash: hash,
    rawFilename: file.name,
    importMethod,
    processingStatus,
    analysisProvider,
    analysisConfidence,
    analysisNotes,
  });

  saveStatementPdf(statement.id, buffer);

  return NextResponse.json(
    {
      statementId: statement.id,
      bank: parsed.header.bank_name,
      periodEnd: parsed.header.period_end,
      transactionCount: parsed.transactions.length,
      importMethod,
      processingStatus,
      analysisProvider,
      analysisConfidence,
      analysisNotes,
    },
    { status: 201 }
  );
}
