import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { buildDownloadFilename, readStatementPdf } from "@/lib/statement-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const statement = await prisma.statement.findUnique({
    where: { id },
    select: {
      userId: true,
      bankName: true,
      periodEnd: true,
      storedFilename: true,
      user: { select: { username: true, displayName: true } },
    },
  });

  if (!statement) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (statement.userId !== session.userId && !isAdmin(session)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  try {
    const buffer = readStatementPdf(id, statement.storedFilename);
    const filename = buildDownloadFilename({
      bankName: statement.bankName,
      type: "resumen",
      period: statement.periodEnd,
      username: statement.user?.displayName ?? statement.user?.username ?? session.username,
      extension: ".pdf",
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });
  }
}
