import { createCanvas } from "canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";

let workerPromise: ReturnType<typeof createWorker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("spa");
  }
  return workerPromise;
}

export async function ocrPdf(buffer: Buffer): Promise<string> {
  const pdfData = new Uint8Array(buffer);

  const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const totalPages = doc.numPages;
  const pageTexts: string[] = [];

  const worker = await getWorker();

  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;

    const pngBuffer = canvas.toBuffer("image/png");

    const { data } = await worker.recognize(pngBuffer);
    pageTexts.push(data.text);

    page.cleanup();
  }

  doc.cleanup();

  return pageTexts.join("\n\n--- PAGE BREAK ---\n\n");
}
