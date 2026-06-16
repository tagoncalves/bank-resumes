import { NextRequest, NextResponse } from "next/server";
import { createCanvas } from "canvas";
import { requireAdmin } from "@/lib/admin";
import { getServerPdfStandardFontDataUrl, loadServerPdfJs } from "@/lib/pdfjs-server";
import { isPdfFilename, readTrainingSourcePdf } from "@/lib/parser-training/source-pdf";
import { prisma } from "@/lib/prisma";
import { getPayslipContentType } from "@/lib/statement-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceType: string; id: string; pageNumber: string }> },
) {
  const auth = await requireAdmin();
  if (auth.deny) return auth.deny;

  try {
    const { sourceType, id, pageNumber } = await params;
    const pageIndex = Number(pageNumber);

    if (!Number.isInteger(pageIndex) || pageIndex < 1) {
      return NextResponse.json({ error: "Número de página inválido" }, { status: 400 });
    }

    const sourceRecord = sourceType === "PAYSLIP"
      ? await prisma.payslip.findUnique({ where: { id }, select: { rawFilename: true } })
      : await prisma.statement.findUnique({ where: { id }, select: { rawFilename: true } });

    if (!sourceRecord) {
      return NextResponse.json({ error: "Archivo fuente no encontrado" }, { status: 404 });
    }

    const pdfBuffer = readTrainingSourcePdf(sourceType, id, sourceRecord.rawFilename);

    if (!isPdfFilename(sourceRecord.rawFilename)) {
      if (pageIndex !== 1) {
        return NextResponse.json({ error: "Página no encontrada" }, { status: 404 });
      }

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": getPayslipContentType(sourceRecord.rawFilename),
          "Cache-Control": "no-store",
        },
      });
    }

    const pdfjs = await loadServerPdfJs();
    const pdfData = new Uint8Array(pdfBuffer);
    const doc = await pdfjs.getDocument({
      data: pdfData,
      standardFontDataUrl: getServerPdfStandardFontDataUrl(),
      disableWorker: true,
    } as any).promise;

    try {
      if (pageIndex > doc.numPages) {
        return NextResponse.json({ error: "Página no encontrada" }, { status: 404 });
      }

      const page = await doc.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
      page.cleanup();

      return new NextResponse(new Uint8Array(canvas.toBuffer("image/png")), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        },
      });
    } finally {
      doc.cleanup();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al renderizar la página";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
