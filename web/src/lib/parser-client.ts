const PARSER_URL = process.env.PARSER_SERVICE_URL ?? "http://localhost:8001";

export interface ParsedTransaction {
  date: string;
  merchant_name: string;
  voucher_number?: string;
  installment_current?: number;
  installment_total?: number;
  amount_ars: number;
  amount_usd?: number;
  card_last_four?: string;
}

export interface ParsedBalanceSummary {
  currency: string;
  previous_balance: number;
  previous_balance_usd?: number;
  payments_applied: number;
  total_consumption: number;
  commission_cuenta_full: number;
  sello_tax: number;
  iva_tax: number;
  iibb_tax: number;
  financing_interest: number;
  current_balance: number;
  current_balance_usd?: number;
  minimum_payment: number;
  tna_ars?: number;
  tem_ars?: number;
  tea_ars?: number;
  tna_usd?: number;
  tem_usd?: number;
  tea_usd?: number;
}

export interface ParsedHeader {
  bank_name: string;
  holder_name: string;
  account_number?: string;
  card_last_four: string;
  card_network: string;
  period_start: string;
  period_end: string;
  due_date: string;
}

export interface ParsedStatement {
  header: ParsedHeader;
  balance_summary: ParsedBalanceSummary;
  transactions: ParsedTransaction[];
  parser_version: string;
}

export async function parseStatementPDF(
  fileBuffer: Buffer,
  filename: string
): Promise<ParsedStatement> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([fileBuffer.buffer as ArrayBuffer], { type: "application/pdf" }),
    filename
  );

  const res = await fetch(`${PARSER_URL}/api/v1/parse`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.detail ?? `Parser service error: ${res.status}`);
  }

  return res.json() as Promise<ParsedStatement>;
}
