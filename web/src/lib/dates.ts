const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (DATE_ONLY_RE.test(value)) {
    return new Date(`${value}T12:00:00.000Z`);
  }
  return new Date(value);
}

export function parseDateRangeStart(value: string): Date {
  if (DATE_ONLY_RE.test(value)) return new Date(`${value}T00:00:00.000Z`);
  return new Date(value);
}

export function parseDateRangeEnd(value: string): Date {
  if (DATE_ONLY_RE.test(value)) return new Date(`${value}T23:59:59.999Z`);
  return new Date(value);
}

export function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateInputValue(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
