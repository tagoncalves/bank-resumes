import { extractPdfText } from "@/lib/pdf-parser";

export type ParsedPayslip = {
  bankName?: string;
  employerName: string;
  employeeName: string;
  periodLabel: string;
  payDate: string;
  netAmountArs: number;
  grossAmountArs?: number;
};

function parseArsNumber(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Importe inválido: ${value}`);
  }
  return parsed;
}

function toIsoDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`Fecha inválida: ${value}`);
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function matchRequired(text: string, regex: RegExp, errorMessage: string): string {
  const match = text.match(regex);
  if (!match?.[1]) {
    throw new Error(errorMessage);
  }
  return match[1].trim();
}

export async function parsePayslipBuffer(buffer: Buffer): Promise<ParsedPayslip> {
  const text = await extractPdfText(buffer);
  const periodMatch = text.match(/Periodo a Pagar\s*Fecha de Pago\s*([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s*(\d{4})\s*(\d{2}\/\d{2}\/\d{4})/m);
  if (!periodMatch) throw new Error("No se pudo obtener el período del recibo");
  const periodLabel = `${periodMatch[1]} ${periodMatch[2]}`;
  const payDateRaw = periodMatch[3];

  const employerName = matchRequired(
    text,
    /Forma de Pago\s*CBU\s+([\s\S]*?)\s+(?:C Pellegrini 91 P\. 5|CUIT:)/m,
    "No se pudo obtener el empleador del recibo"
  ).split("\n").find(Boolean)?.trim() ?? "";

  const bankMatch = text.match(/CBU\s*-\s*Banco\s*([A-Za-zÁÉÍÓÚáéíóúñÑ ]+?)(?=\d)/m);
  const bankName = bankMatch?.[1]?.trim() ? `Banco ${bankMatch[1].trim()}` : undefined;

  const employeeName = matchRequired(
    text,
    /Legajo\s*Apellido y Nombres\s*Fecha de Ingreso\s*Numero de CUIL\s*Sueldo Basico\s*\d+\s*([A-Za-zÁÉÍÓÚáéíóúñÑ, ]+?)(?=\d{2}\/\d{2}\/\d{4})/m,
    "No se pudo obtener el nombre del empleado"
  );

  const grossMatch = text.match(/Totales\s*((?:\d{1,3}\.)*\d+,\d{2})\s*((?:\d{1,3}\.)*\d+,\d{2})\s*((?:\d{1,3}\.)*\d+,\d{2})\s*((?:\d{1,3}\.)*\d+,\d{2})/m);
  if (!grossMatch) throw new Error("No se pudo obtener el total bruto del recibo");
  const grossAmountRaw = grossMatch[1];

  const netSection = text.split(/Neto a Cobrar/m)[1] ?? "";
  const netMatches = Array.from(netSection.matchAll(/(?:\d{1,3}\.)*\d+,\d{2}/g)).map((match) => match[0]);
  const netAmountRaw = netMatches.at(-1);
  if (!netAmountRaw) {
    throw new Error("No se pudo obtener el neto a cobrar");
  }

  return {
    bankName,
    employerName,
    employeeName,
    periodLabel,
    payDate: toIsoDate(payDateRaw),
    netAmountArs: parseArsNumber(netAmountRaw),
    grossAmountArs: parseArsNumber(grossAmountRaw),
  };
}
