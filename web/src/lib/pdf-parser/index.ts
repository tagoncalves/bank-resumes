import type { ParsedStatement } from "./types";
import { parseBBVA } from "./bbva";
import { parseGalicia } from "./galicia";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

function detectBank(text: string): "BBVA" | "Galicia" {
  const upper = text.toUpperCase();
  if (upper.includes("BBVA")) return "BBVA";
  if (upper.includes("GALICIA")) return "Galicia";
  throw new Error("Banco no reconocido. Verificá que el PDF sea de BBVA o Galicia.");
}

export async function parseStatementBuffer(buffer: Buffer): Promise<ParsedStatement> {
  const pdf = await pdfParse(buffer);
  const text: string = pdf.text;
  const lines = text
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  const bank = detectBank(text);

  if (bank === "BBVA") return parseBBVA(text, lines);
  return parseGalicia(text, lines);
}
