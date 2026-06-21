import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const results = await prisma.payslip.findMany({
    where: {
      employerName: { not: null },
    },
    select: { employerName: true },
    distinct: ["employerName"],
    orderBy: { employerName: "asc" },
  });

  const employers = results
    .map((r) => r.employerName)
    .filter((n): n is string => n !== null);

  return NextResponse.json({ employers });
}
