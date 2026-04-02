import type { ParsedStatement } from "./types";
import { parseBBVA } from "./bbva";
import { parseGalicia } from "./galicia";

function detectBank(text: string): "BBVA" | "Galicia" {
  const upper = text.toUpperCase();
  if (upper.includes("BBVA")) return "BBVA";
  if (upper.includes("GALICIA")) return "Galicia";
  throw new Error("Banco no reconocido. Verificá que el PDF sea de BBVA o Galicia.");
}

export async function parseStatementBuffer(buffer: Buffer): Promise<ParsedStatement> {
  // Require lazy para evitar ejecución en build-time (pdf-parse usa fs internamente)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("pdf-parse");
  const pdfParse = mod.default ?? mod;

  const pdf = await pdfParse(buffer);
  const text: string = pdf.text;
  const lines: string[] = text
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  const bank = detectBank(text);
  return bank === "BBVA" ? parseBBVA(text, lines) : parseGalicia(text, lines);
}
