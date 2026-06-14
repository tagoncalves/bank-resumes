import { Prisma } from "@prisma/client";

export type MoneyValue = Prisma.Decimal | number | string | null | undefined;

function isDecimalLike(value: unknown): value is Prisma.Decimal {
  return typeof value === "object" && value !== null && "toNumber" in value;
}

export function toMoneyNumber(value: MoneyValue): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (isDecimalLike(value)) return value.toNumber();
  return Number(value);
}

export function toNullableMoneyNumber(value: MoneyValue): number | null {
  return value == null ? null : toMoneyNumber(value);
}

export function money(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

export function nullableMoney(value: number | string | null | undefined): Prisma.Decimal | null {
  return value == null ? null : money(value);
}

export function requireMoneyInput(value: unknown, fieldName: string): Prisma.Decimal {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} inválido`);
  }

  return money(value);
}

export function optionalMoneyInput(value: unknown, fieldName: string): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return requireMoneyInput(value, fieldName);
}
