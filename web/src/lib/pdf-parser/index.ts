import type { ParsedStatement } from "./types";
import { parseBBVA } from "./bbva";
import { parseGalicia } from "./galicia";

function detectBank(text: string): "BBVA" | "Galicia" {
  const upper = text.toUpperCase();
  if (upper.includes("BBVA")) return "BBVA";
  if (upper.includes("GALICIA")) return "Galicia";
  throw new Error("Banco no reconocido. Verificá que el PDF sea de BBVA o Galicia.");
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // Require lazy para evitar ejecución en build-time (pdf-parse usa fs internamente)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("pdf-parse/lib/pdf-parse.js");
  const pdfParse = mod.default ?? mod;

  const pdf = await pdfParse(buffer);
  const text = (pdf.text as string)?.trim() ?? "";

  // If pdf-parse returned meaningful text, use it
  if (text.length > 50) {
    return text;
  }

  // Fall back to OCR for image-based/scanned PDFs
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ocrPdf } = require("../ocr");
    const ocrText = await ocrPdf(buffer);
    return ocrText;
  } catch {
    // If OCR also fails, return whatever pdf-parse gave us
    return text || "No se pudo extraer texto del PDF";
  }
}

export async function parseStatementBuffer(buffer: Buffer): Promise<ParsedStatement> {
  const text = await extractPdfText(buffer);
  const lines: string[] = text
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  const bank = detectBank(text);
  return bank === "BBVA" ? parseBBVA(text, lines) : parseGalicia(text, lines);
}
