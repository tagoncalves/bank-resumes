import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { extractRegionTextFromPdf } from "@/lib/parser-training/region-extractor";
import { readTrainingSourcePdf } from "@/lib/parser-training/source-pdf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceType: string; id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.deny) return auth.deny;

  try {
    const { sourceType, id } = await params;
    const body = await request.json();
    const { pageNumber, x0, top, x1, bottom, mode } = body;

    if ([pageNumber, x0, top, x1, bottom].some((value) => value == null)) {
      return NextResponse.json({ error: "Faltan coordenadas de la región" }, { status: 400 });
    }

    const sourceRecord = sourceType === "PAYSLIP"
      ? await prisma.payslip.findUnique({ where: { id }, select: { rawFilename: true, storedFilename: true } })
      : await prisma.statement.findUnique({ where: { id }, select: { rawFilename: true, storedFilename: true } });

    if (!sourceRecord) {
      return NextResponse.json({ error: "Archivo fuente no encontrado" }, { status: 404 });
    }

    const buffer = readTrainingSourcePdf(sourceType, id, sourceRecord.rawFilename, sourceRecord.storedFilename);
    const rawText = await extractRegionTextFromPdf(buffer, {
      pageNumber: Number(pageNumber),
      x0: Number(x0),
      top: Number(top),
      x1: Number(x1),
      bottom: Number(bottom),
      mode: typeof mode === "string" ? mode : "region_exact",
    }, sourceRecord.rawFilename);

    return NextResponse.json({ rawText });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al extraer texto de la región";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
