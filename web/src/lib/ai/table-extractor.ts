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

export function validateExtractedValues(
  values: Record<string, string | number | undefined | null>,
  pdfText: string,
): string[] {
  const errors: string[] = [];
  const textUpper = pdfText.toUpperCase();

  for (const [field, value] of Object.entries(values)) {
    if (value == null || value === "") continue;
    const strValue = String(value);
    // Skip numeric-only values (these are usually valid even if formatting differs)
    if (/^\d+(\.\d+)?$/.test(strValue)) continue;

    // Check if the value (or a close variant) appears in the PDF text
    if (!textUpper.includes(strValue.toUpperCase())) {
      // Try without currency symbols
      const clean = strValue.replace(/[$ARS\s]/g, "").toUpperCase();
      if (clean.length > 2 && !textUpper.includes(clean)) {
        errors.push(`"${field}" = "${strValue}" no se encontró textualmente en el PDF`);
      }
    }
  }

  return errors;
}
