import { ocrImageRegion, ocrPdfRegion } from "@/lib/ocr";
import {
  extractWordsFromPdf,
  findWordsInRegion,
  findWordsRightOfLabel,
  type WordWithPosition,
} from "@/lib/parser-training/pdf-words";
import { isPdfFilename } from "@/lib/parser-training/source-pdf";
import type {
  ParserOutput,
  ParserTestResult,
  TrainingAnchor,
} from "@/lib/parser-training/deterministic-parser";

function normalizeString(val: string): string {
  return val.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeMoney(val: string): string {
  const cleaned = val.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? val.trim() : num.toFixed(2);
}

function normalizeDate(val: string): string {
  const cleaned = val.trim();
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const ymd = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return cleaned;
}

function normalizeByFieldType(fieldName: string, val: string): string {
  if (fieldName === "net_amount_ars" || fieldName === "gross_amount_ars") return normalizeMoney(val);
  if (fieldName === "pay_date") return normalizeDate(val);
  return normalizeString(val);
}

function sanitizeExtractedText(val: string | null | undefined): string {
  if (!val) return "";

  return val
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableExtractedText(val: string | null | undefined): boolean {
  const text = sanitizeExtractedText(val);
  if (!text) return false;

  if (/[\uFFFD\u25A1\u25A0\u25AD\u25AF]/.test(text)) return false;

  const visibleChars = text.replace(/\s+/g, "");
  if (!visibleChars) return false;

  const usefulChars = (text.match(/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,:/()$-]/g) ?? []).length;
  return usefulChars / visibleChars.length >= 0.45;
}

function extractFromWords(words: WordWithPosition[], anchor: TrainingAnchor): string | null {
  if (anchor.mode === "right_of_label") {
    const found = findWordsRightOfLabel(
      words,
      anchor.pageNumber,
      anchor.x0,
      anchor.top,
      anchor.x1,
      anchor.bottom,
    );
    const text = found.length > 0 ? sanitizeExtractedText(found.join(" ")) : "";
    return isUsableExtractedText(text) ? text : null;
  }

  const found = findWordsInRegion(
    words,
    anchor.pageNumber,
    anchor.x0,
    anchor.top,
    anchor.x1,
    anchor.bottom,
  );
  const text = found.length > 0 ? sanitizeExtractedText(found.join(" ")) : "";
  return isUsableExtractedText(text) ? text : null;
}

function expandAnchor(anchor: TrainingAnchor, delta: number): TrainingAnchor {
  return {
    ...anchor,
    x0: Math.max(0, anchor.x0 - delta),
    x1: anchor.x1 + delta,
    top: anchor.top + delta,
    bottom: Math.max(0, anchor.bottom - delta),
  };
}

function extractFromWordsWithTolerance(words: WordWithPosition[], anchor: TrainingAnchor): string | null {
  return extractFromWords(words, anchor)
    || extractFromWords(words, expandAnchor(anchor, 8))
    || extractFromWords(words, expandAnchor(anchor, 18));
}

export async function extractRegionTextFromPdf(
  buffer: Buffer,
  anchor: Pick<TrainingAnchor, "pageNumber" | "x0" | "top" | "x1" | "bottom" | "mode">,
  rawFilename?: string | null,
): Promise<string> {
  if (isPdfFilename(rawFilename)) {
    const extraction = await extractWordsFromPdf(buffer);
    const text = extractFromWordsWithTolerance(extraction.words, anchor as TrainingAnchor);
    if (text) return text;

    try {
      const ocrText = sanitizeExtractedText(await ocrPdfRegion(buffer, anchor));
      return isUsableExtractedText(ocrText) ? ocrText : "";
    } catch {
      return "";
    }
  }

  try {
    const ocrText = sanitizeExtractedText(await ocrImageRegion(buffer, anchor));
    return isUsableExtractedText(ocrText) ? ocrText : "";
  } catch {
    return "";
  }
}

export async function runDeterministicParserForPdf(
  buffer: Buffer,
  anchors: TrainingAnchor[],
  rawFilename?: string | null,
): Promise<ParserOutput> {
  const extraction = isPdfFilename(rawFilename) ? await extractWordsFromPdf(buffer) : null;
  const fields: Record<string, string | null> = {};
  const testResults: ParserTestResult[] = [];

  for (const anchor of anchors) {
    const textFromWords = extraction ? extractFromWordsWithTolerance(extraction.words, anchor) : null;
    let extracted = textFromWords;

    if (!extracted) {
      try {
        const ocrText = sanitizeExtractedText(
          isPdfFilename(rawFilename) ? await ocrPdfRegion(buffer, anchor) : await ocrImageRegion(buffer, anchor),
        );
        extracted = isUsableExtractedText(ocrText) ? ocrText : null;
      } catch {
        extracted = null;
      }
    }

    fields[anchor.fieldName] = extracted || null;

    let passed = false;
    if (anchor.confirmedText && extracted) {
      passed = normalizeByFieldType(anchor.fieldName, anchor.confirmedText) === normalizeByFieldType(anchor.fieldName, extracted);
    } else if (!anchor.confirmedText) {
      passed = true;
    }

    testResults.push({
      fieldName: anchor.fieldName,
      expected: anchor.confirmedText ?? null,
      extracted: extracted || null,
      passed,
      normalizedExpected: anchor.confirmedText ? normalizeByFieldType(anchor.fieldName, anchor.confirmedText) : null,
      normalizedExtracted: extracted ? normalizeByFieldType(anchor.fieldName, extracted) : null,
    });
  }

  return {
    fields,
    testResults,
    allPassed: testResults.length > 0 && testResults.every((item) => item.passed),
  };
}
