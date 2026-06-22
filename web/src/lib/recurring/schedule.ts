import { dateInputValue, parseDateOnly } from "@/lib/dates";

export type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export const FREQUENCIES = new Set<RecurringFrequency>(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);

export type RecurringScheduleInput = {
  anchorDate: string | Date;
  frequency: string;
  interval?: number | null;
  from: string | Date;
  to: string | Date;
  max?: number;
};

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function normalizeDate(value: string | Date) {
  return parseDateOnly(value);
}

function startOfDateOnly(value: string | Date) {
  const d = normalizeDate(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function normalizeFrequency(value: string | null | undefined): RecurringFrequency {
  const normalized = String(value ?? "MONTHLY").toUpperCase();
  return FREQUENCIES.has(normalized as RecurringFrequency) ? (normalized as RecurringFrequency) : "MONTHLY";
}

export function normalizeInterval(value: number | string | null | undefined) {
  const parsed = Number(value ?? 1);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(120, Math.trunc(parsed));
}

function shiftRecurringDate(
  value: string | Date,
  frequencyInput: string,
  intervalInput?: number | string | null,
  anchorDateInput?: string | Date | null,
  direction: 1 | -1 = 1,
) {
  const date = normalizeDate(value);
  const frequency = normalizeFrequency(frequencyInput);
  const interval = normalizeInterval(intervalInput) * direction;
  const anchor = anchorDateInput ? normalizeDate(anchorDateInput) : date;

  if (frequency === "DAILY") {
    return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + interval);
  }

  if (frequency === "WEEKLY") {
    return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + interval * 7);
  }

  if (frequency === "YEARLY") {
    const year = date.getUTCFullYear() + interval;
    const month = anchor.getUTCMonth();
    const day = Math.min(anchor.getUTCDate(), daysInMonth(year, month));
    return utcDate(year, month, day);
  }

  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + interval;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const day = Math.min(anchor.getUTCDate(), daysInMonth(year, month));
  return utcDate(year, month, day);
}

export function advanceRecurringDate(
  value: string | Date,
  frequencyInput: string,
  intervalInput?: number | string | null,
  anchorDateInput?: string | Date | null,
) {
  return shiftRecurringDate(value, frequencyInput, intervalInput, anchorDateInput, 1);
}

export function retreatRecurringDate(
  value: string | Date,
  frequencyInput: string,
  intervalInput?: number | string | null,
  anchorDateInput?: string | Date | null,
) {
  return shiftRecurringDate(value, frequencyInput, intervalInput, anchorDateInput, -1);
}

export function generateOccurrenceDates(input: RecurringScheduleInput) {
  const max = Math.min(Math.max(input.max ?? 120, 1), 500);
  const anchor = normalizeDate(input.anchorDate);
  const fromTime = startOfDateOnly(input.from);
  const toTime = startOfDateOnly(input.to);
  if (fromTime > toTime) return [];

  const dates: Date[] = [];
  let cursor = anchor;
  let safety = 0;

  while (startOfDateOnly(cursor) > fromTime && safety < 1000) {
    const previous = retreatRecurringDate(cursor, input.frequency, input.interval, anchor);
    if (startOfDateOnly(previous) < fromTime) break;
    cursor = previous;
    safety += 1;
  }

  while (startOfDateOnly(cursor) < fromTime && safety < 1000) {
    cursor = advanceRecurringDate(cursor, input.frequency, input.interval, anchor);
    safety += 1;
  }

  while (startOfDateOnly(cursor) <= toTime && dates.length < max && safety < 1500) {
    dates.push(cursor);
    cursor = advanceRecurringDate(cursor, input.frequency, input.interval, anchor);
    safety += 1;
  }

  return dates;
}

export function nextOccurrenceAfter(input: {
  anchorDate: string | Date;
  frequency: string;
  interval?: number | string | null;
  after: string | Date;
}) {
  const afterTime = startOfDateOnly(input.after);
  let cursor = normalizeDate(input.anchorDate);
  let safety = 0;

  while (startOfDateOnly(cursor) <= afterTime && safety < 1000) {
    cursor = advanceRecurringDate(cursor, input.frequency, input.interval, input.anchorDate);
    safety += 1;
  }

  return cursor;
}

export function formatOccurrenceDates(dates: Date[]) {
  return dates.map(dateInputValue);
}
