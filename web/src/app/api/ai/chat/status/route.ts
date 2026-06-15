import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBlockStatus } from "@/lib/ai/misuse-tracker";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const status = await getBlockStatus(session.userId);
  return NextResponse.json(status);
}
