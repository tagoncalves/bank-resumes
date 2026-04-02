/**
 * Parse Argentine number format: "1.234,56" → 1234.56
 * Also handles: "-1.234,56", "(1.234,56)", "$ 1.234,56"
 */
export function parseARS(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.trim();
  const negative = cleaned.startsWith("-") || (cleaned.startsWith("(") && cleaned.endsWith(")"));
  const stripped = cleaned.replace(/[$\-\(\)\s]/g, "");
  if (!stripped) return 0;

  let normalized: string;
  if (stripped.includes(",")) {
    // Argentine: dots = thousands, comma = decimal
    normalized = stripped.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(stripped)) {
    // All dots are thousands separators
    normalized = stripped.replace(/\./g, "");
  } else {
    normalized = stripped;
  }

  const result = parseFloat(normalized);
  return isNaN(result) ? 0 : negative ? -result : result;
}

export function parsePct(raw: string): number {
  return parseFloat(raw.replace("%", "").replace(",", ".").trim()) || 0;
}

// Matches Argentine currency amounts: 1.234,56 or 1234,56
export const AMT = /(\d{1,3}(?:\.\d{3})*,\d{2})/;
export const AMT_G = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
