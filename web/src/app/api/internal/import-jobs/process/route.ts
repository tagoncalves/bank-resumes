import { NextRequest, NextResponse } from "next/server";
import { processNextQueuedImportJob } from "@/lib/import-jobs";

function isAuthorized(req: NextRequest) {
  const secret = process.env.WORKER_SHARED_SECRET ?? "dev-worker-secret";
  return req.headers.get("x-worker-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const result = await processNextQueuedImportJob();
  return NextResponse.json(result);
}
