export function parseMoneyInput(value: string): string {
  const cleaned = value.replace(/[^0-9.,]/g, "");
  if (!cleaned) return "";

  const commaIndex = cleaned.lastIndexOf(",");
  if (commaIndex >= 0) {
    const integer = cleaned.slice(0, commaIndex).replace(/[^0-9]/g, "");
    const decimal = cleaned.slice(commaIndex + 1).replace(/[^0-9]/g, "").slice(0, 2);
    return decimal ? `${integer || "0"}.${decimal}` : integer;
  }

  return cleaned.replace(/[^0-9]/g, "");
}

export function formatMoneyInput(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const raw = String(value);
  const normalized = /^\d+(\.\d{1,2})?$/.test(raw) ? raw : parseMoneyInput(raw);
  if (!normalized) return "";

  const [integerRaw, decimalRaw] = normalized.split(".");
  const integer = integerRaw.replace(/^0+(?=\d)/, "") || "0";
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimalRaw != null && decimalRaw !== "" ? `${formattedInteger},${decimalRaw}` : formattedInteger;
}

export function parseMoneyNumber(value: string): number {
  return Number(parseMoneyInput(value));
}
