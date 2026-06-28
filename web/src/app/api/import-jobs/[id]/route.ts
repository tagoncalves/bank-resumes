import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getImportJobForUser } from "@/lib/import-jobs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const job = await getImportJobForUser(id, session.userId);

  if (!job) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    bankName: job.bankName,
    statementId: job.statementId,
    importMethod: job.importMethod,
    analysisProvider: job.analysisProvider,
    analysisModel: job.analysisModel,
    analysisPromptVersion: job.analysisPromptVersion,
    analysisConfidence: job.analysisConfidence,
    analysisNotes: job.analysisNotes,
    errorMessage: job.errorMessage,
  });
}
