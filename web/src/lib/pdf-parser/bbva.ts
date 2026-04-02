import { parseARS, parsePct, AMT } from "./amounts";
import { matchAll } from "./utils";
import { parseDate, findDates } from "./dates";
import type { ParsedStatement, ParsedHeader, ParsedBalanceSummary, ParsedTransaction } from "./types";

export function parseBBVA(text: string, lines: string[]): ParsedStatement {
  return {
    header: parseHeader(text, lines),
    balance_summary: parseBalance(text),
    transactions: parseTransactions(lines),
    parser_version: "js-1.0.0",
  };
}

function parseHeader(text: string, lines: string[]): ParsedHeader {
  // Card last four: look for **** **** **** XXXX or similar
  const cardM = text.match(/\*+\s*\*+\s*\*+\s*(\d{4})/);
  const cardLastFour = cardM?.[1] ?? "0000";

  // Holder name
  let holderName = "Titular BBVA";
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/[Tt]itular[:\s]+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]{3,40})/);
    if (m) { holderName = m[1].trim(); break; }
  }

  // Dates: cierre anterior, cierre actual, vencimiento
  const cierreAnt = text.match(/[Cc]ierre\s+[Aa]nterior[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/);
  const cierreAct = text.match(/[Cc]ierre\s+[Aa]ctual[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/);
  const vencM     = text.match(/[Vv]encimiento[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/);

  const allDates = findDates(text);
  const today = new Date().toISOString().slice(0, 10);

  const periodStart = (cierreAnt?.[1] && parseDate(cierreAnt[1])) ?? allDates[0] ?? today;
  const periodEnd   = (cierreAct?.[1] && parseDate(cierreAct[1])) ?? allDates[1] ?? today;
  const dueDate     = (vencM?.[1]     && parseDate(vencM[1]))     ?? allDates[2] ?? today;

  // Account number
  const accM = text.match(/(?:[Cc]uenta|cuenta\s+N[°º]?)[:\s]+([\d\-]{6,})/);

  return {
    bank_name: "BBVA",
    holder_name: holderName,
    account_number: accM?.[1],
    card_last_four: cardLastFour,
    card_network: "Visa",
    period_start: periodStart,
    period_end: periodEnd,
    due_date: dueDate,
  };
}

function findAmt(text: string, pattern: RegExp | string): number {
  const re = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
  const m = text.match(re);
  return m ? parseARS(m[1]) : 0;
}

const A = AMT.source;
function parseBalance(text: string): ParsedBalanceSummary {
  const a = (s: string) => findAmt(text, s);

  const tnas = matchAll(text, /TNA[:\s]+([\d,.]+)\s*%/gi).map((m) => parsePct(m[1]));
  const tems = matchAll(text, /TEM[:\s]+([\d,.]+)\s*%/gi).map((m) => parsePct(m[1]));
  const teas = matchAll(text, /TEA[:\s]+([\d,.]+)\s*%/gi).map((m) => parsePct(m[1]));

  return {
    currency: "ARS",
    previous_balance:       a(`[Ss]aldo\\s+[Aa]nterior[^$\\d\\n]{0,30}${A}`),
    payments_applied:       a(`[Pp]agos?\\s+[Rr]ecibidos?[^$\\d\\n]{0,30}${A}`),
    total_consumption:      a(`[Cc]onsumos?[^$\\d\\n]{0,30}${A}`),
    commission_cuenta_full: a(`[Cc]omisi[oó]n\\s+[Cc]uenta\\s+[Ff]ull[^$\\d\\n]{0,30}${A}`),
    sello_tax:              a(`[Ss]ello[^$\\d\\n]{0,20}${A}`),
    iva_tax:                a(`IVA[^$\\d\\n]{0,20}${A}`),
    iibb_tax:               a(`IIBB[^$\\d\\n]{0,20}${A}`),
    financing_interest:     a(`[Ii]ntereses?\\s+[Ff]inanciamiento[^$\\d\\n]{0,30}${A}`),
    current_balance:        a(`[Ss]aldo\\s+[Aa]ctual[^$\\d\\n]{0,30}${A}`),
    minimum_payment:        a(`[Pp]ago\\s+[Mm][íi]nimo[^$\\d\\n]{0,30}${A}`),
    tna_ars: tnas[0],
    tem_ars: tems[0],
    tea_ars: teas[0],
  };
}

const DATE_LINE = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+)/;
const INSTALLMENT = /\b(?:CTA\s+)?(\d{1,2})\/(\d{1,2})\b/;
const TRAILING_AMT = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
const TRAILING_NUM = /\s(\d{6,})$/;
const SKIP = /^(FECHA|DESCRIPC|IMPORTE|TOTAL|SALDO)/i;

function parseTransactions(lines: string[]): ParsedTransaction[] {
  const txs: ParsedTransaction[] = [];

  for (const line of lines) {
    const lm = line.match(DATE_LINE);
    if (!lm) continue;

    const date = parseDate(lm[1]);
    if (!date) continue;

    let rest = lm[2].trim();
    if (SKIP.test(rest)) continue;

    // Amount
    const am = rest.match(TRAILING_AMT);
    if (!am) continue;
    const amount_ars = parseARS(am[1]);
    rest = rest.slice(0, rest.lastIndexOf(am[1])).trim();

    // Installment
    let installment_current: number | undefined;
    let installment_total: number | undefined;
    const im = rest.match(INSTALLMENT);
    if (im) {
      installment_current = parseInt(im[1], 10);
      installment_total   = parseInt(im[2], 10);
      rest = rest.replace(im[0], "").trim();
    }

    // Voucher (long trailing number)
    let voucher_number: string | undefined;
    const vm = rest.match(TRAILING_NUM);
    if (vm) {
      voucher_number = vm[1];
      rest = rest.slice(0, rest.lastIndexOf(vm[1])).trim();
    }

    const merchant_name = rest.trim();
    if (!merchant_name || merchant_name.length < 2) continue;

    txs.push({
      date,
      merchant_name,
      voucher_number,
      installment_current,
      installment_total,
      amount_ars,
    });
  }

  return txs;
}
