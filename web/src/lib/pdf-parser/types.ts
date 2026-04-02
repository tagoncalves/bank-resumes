export interface ParsedTransaction {
  date: string;           // ISO date YYYY-MM-DD
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
