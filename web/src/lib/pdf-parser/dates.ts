const FMTS = [
  /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
  /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
  /^(\d{2})\/(\d{2})\/(\d{2})$/, // DD/MM/YY
  /^(\d{2})-(\d{2})-(\d{2})$/,   // DD-MM-YY
];

const ES_MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** Parse DD-Mon-YY or DD-Mon-YYYY (Spanish month abbreviation) */
function parseSpanishDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = ES_MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += year >= 50 ? 1900 : 2000;
  if (day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDate(raw: string): string | null {
  const s = raw.trim();
  const spanish = parseSpanishDate(s);
  if (spanish) return spanish;
  for (const re of FMTS) {
    const m = s.match(re);
    if (!m) continue;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/** Find all dates (numeric or Spanish-month) in a text block */
export function findDates(text: string): string[] {
  const pattern = /\d{2}[/\-](?:\d{2}|[A-Za-z]{3})[/\-]\d{2,4}/g;
  const raw: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) raw.push(m[0]);
  return raw.map(parseDate).filter(Boolean) as string[];
}
