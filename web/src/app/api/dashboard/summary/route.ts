import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/data";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const months = Math.max(1, Math.min(24, parseInt(searchParams.get("months") ?? "6", 10) || 6));
  const origin = searchParams.get("origin") ?? undefined;

  let from: Date | undefined;
  let to: Date | undefined;

  if (month) {
    const [y, m] = month.split("-").map(Number);
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 0, 23, 59, 59);
  }

  const summary = await getDashboardSummary({ months, from, to, userId: session.userId, origin });
  return NextResponse.json(summary);
}
