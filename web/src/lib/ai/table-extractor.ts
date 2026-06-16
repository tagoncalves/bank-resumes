export type TableRow = {
  label: string;
  value: string;
  lineIndex: number;
};

export type ExtractedTable = {
  rows: TableRow[];
  rawLines: string[];
};

export function extractTableStructure(pdfText: string): ExtractedTable {
  const lines = pdfText.split("\n");
  const rows: TableRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Skip lines that are too short or look like headers/footers
    if (trimmed.length < 4) continue;

    // Pattern 1: "LABEL : VALUE" or "LABEL: VALUE"
    const colonMatch = trimmed.match(/^(.+?)\s*:\s*(.+)$/);
    if (colonMatch) {
      const label = colonMatch[1].trim();
      const value = colonMatch[2].trim();
      if (label.length > 1 && value.length > 0 && label.length < 80) {
        rows.push({ label, value, lineIndex: i });
        continue;
      }
    }

    // Pattern 2: multiple spaces separating label from value (table layout)
    const multiSpaceMatch = trimmed.match(/^(.{2,80}?)\s{3,}(.+)$/);
    if (multiSpaceMatch) {
      const label = multiSpaceMatch[1].trim();
      const value = multiSpaceMatch[2].trim();
      // Avoid matching if the "label" looks like a number or the "value" looks like another label
      if (
        label.length > 1 &&
        label.length < 60 &&
        value.length > 0 &&
        !/^\d{1,2}\/\d/.test(label) &&
        !/^[A-Z]{2,}$/.test(value)
      ) {
        rows.push({ label, value, lineIndex: i });
      }
    }
  }

  return { rows, rawLines: lines };
}

export function formatTableForPrompt(table: ExtractedTable): string {
  if (table.rows.length === 0) return "";
  const lines = table.rows.map(
    (r, i) => `  [${i + 1}] "${r.label}" → "${r.value}"`,
  );
  return [
    "",
    "ESTA es la ÚNICA estructura de datos encontrada en el PDF (formato tabla: etiqueta a la izquierda, valor a la derecha):",
    ...lines,
    "",
    "REGLAS ESTRICTAS:",
    "- NO inventes etiquetas ni valores que no aparezcan arriba.",
    "- Cada campo que devuelvas debe mapear DIRECTAMENTE a una de las filas de esta tabla.",
    "- Si un campo solicitado no existe en la tabla, devolvelo vacío o null.",
    "- NO uses valores hardcodeados, placeholder ni datos mock.",
    "- El valor debe ser exactamente lo que aparece en la columna derecha.",
    "",
  ].join("\n");
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
}

function extractSignificantWords(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w));
}

export function validateExtractedValues(
  values: Record<string, string | number | undefined | null>,
  pdfText: string,
): string[] {
  const errors: string[] = [];
  const normalizedPdf = normalizeText(pdfText);

  for (const [field, value] of Object.entries(values)) {
    if (value == null || value === "") continue;
    const strValue = String(value);

    // Skip pure numeric values (amounts are validated structurally, not textually)
    if (/^-?\d+(\.\d+)?$/.test(strValue)) continue;

    const significantWords = extractSignificantWords(strValue);
    if (significantWords.length === 0) continue;

    // Check that at least half of the significant words appear in PDF
    const wordsFound = significantWords.filter((w) =>
      normalizedPdf.includes(w),
    );
    const ratio = wordsFound.length / significantWords.length;

    if (ratio < 0.5) {
      errors.push(
        `"${field}" = "${strValue}" (solo ${wordsFound.length}/${significantWords.length} palabras significativas encontradas en el PDF)`,
      );
    }
  }

  return errors;
}
