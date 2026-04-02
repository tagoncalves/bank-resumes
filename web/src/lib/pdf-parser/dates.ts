const FMTS = [
  /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
  /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
  /^(\d{2})\/(\d{2})\/(\d{2})$/, // DD/MM/YY
  /^(\d{2})-(\d{2})-(\d{2})$/,   // DD-MM-YY
];

export function parseDate(raw: string): string | null {
  const s = raw.trim();
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

/** Find all DD/MM/YY or DD/MM/YYYY dates in a text block */
export function findDates(text: string): string[] {
  const pattern = /\d{2}[/\-]\d{2}[/\-]\d{2,4}/g;
  const raw: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) raw.push(m[0]);
  return raw.map(parseDate).filter(Boolean) as string[];
}
