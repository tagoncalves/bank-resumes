import { createCanvas, loadImage } from "canvas";
import { createWorker } from "tesseract.js";
import { getServerPdfStandardFontDataUrl, loadServerPdfJs } from "@/lib/pdfjs-server";

type RegionBounds = {
  pageNumber: number;
  x0: number;
  top: number;
  x1: number;
  bottom: number;
};

let workerPromise: ReturnType<typeof createWorker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("spa");
  }
  return workerPromise;
}

export async function ocrPdf(buffer: Buffer): Promise<string> {
  const pdfData = new Uint8Array(buffer);
  const pdfjsLib = await loadServerPdfJs();

  const doc = await pdfjsLib.getDocument({
    data: pdfData,
    standardFontDataUrl: getServerPdfStandardFontDataUrl(),
    disableWorker: true,
  } as any).promise;
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

export async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text.trim();
}

export async function ocrImageRegion(buffer: Buffer, region: RegionBounds): Promise<string> {
  const image = await loadImage(buffer);
  const pad = 8;
  const left = Math.max(0, Math.floor(region.x0) - pad);
  const right = Math.min(image.width, Math.ceil(region.x1) + pad);
  const top = Math.max(0, Math.floor(image.height - region.top) - pad);
  const bottom = Math.min(image.height, Math.ceil(image.height - region.bottom) + pad);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  const cropCanvas = createCanvas(width, height);
  const cropCtx = cropCanvas.getContext("2d");
  cropCtx.fillStyle = "white";
  cropCtx.fillRect(0, 0, width, height);
  cropCtx.drawImage(image, left, top, width, height, 0, 0, width, height);

  const worker = await getWorker();
  const { data } = await worker.recognize(cropCanvas.toBuffer("image/png"));
  return data.text.trim();
}

export async function ocrPdfRegion(buffer: Buffer, region: RegionBounds): Promise<string> {
  const pdfData = new Uint8Array(buffer);
  const pdfjsLib = await loadServerPdfJs();
  const doc = await pdfjsLib.getDocument({
    data: pdfData,
    standardFontDataUrl: getServerPdfStandardFontDataUrl(),
    disableWorker: true,
  } as any).promise;

  try {
    const page = await doc.getPage(region.pageNumber);
    const scale = 3.0;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;

    const pad = 8;
    const left = Math.max(0, Math.floor(region.x0 * scale) - pad);
    const right = Math.min(canvas.width, Math.ceil(region.x1 * scale) + pad);
    const top = Math.max(0, Math.floor((viewport.height / scale - region.top) * scale) - pad);
    const bottom = Math.min(canvas.height, Math.ceil((viewport.height / scale - region.bottom) * scale) + pad);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);

    const cropCanvas = createCanvas(width, height);
    const cropCtx = cropCanvas.getContext("2d");
    cropCtx.fillStyle = "white";
    cropCtx.fillRect(0, 0, width, height);
    cropCtx.drawImage(canvas, left, top, width, height, 0, 0, width, height);

    const worker = await getWorker();
    const { data } = await worker.recognize(cropCanvas.toBuffer("image/png"));

    page.cleanup();
    return data.text.trim();
  } finally {
    doc.cleanup();
  }
}
