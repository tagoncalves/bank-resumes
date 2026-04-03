import { parseARS, parsePct } from "./amounts";
import { parseDate } from "./dates";
import type { ParsedStatement, ParsedHeader, ParsedBalanceSummary, ParsedTransaction } from "./types";

export function parseBBVA(text: string, lines: string[]): ParsedStatement {
  return {
    header: parseHeader(text, lines),
    balance_summary: parseBalance(lines),
    transactions: parseTransactions(lines),
    parser_version: "js-1.0.0",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AMT_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})/;

/**
 * Find the amount for a label in the lines array.
 * Strips parenthesized numbers (base amounts), then checks same line, then next line.
 * nextLineOnly=true forces looking at the next line (used when same-line value is the base, not the tax).
 */
function findAmt(lines: string[], labelRe: RegExp, nextLineOnly = false): number {
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue;
    if (!nextLineOnly) {
      const stripped = lines[i].replace(/\([^)]+\)/g, "");
      const m = stripped.match(AMT_RE);
      if (m) return parseARS(m[1]);
    }
    if (i + 1 < lines.length) {
      const m = lines[i + 1].match(/^(-?)(\d{1,3}(?:\.\d{3})*,\d{2})/);
      if (m) return (m[1] === "-" ? -1 : 1) * parseARS(m[2]);
    }
  }
  return 0;
}

/** Sum all matching label occurrences (for taxes that appear multiple times, e.g. sello × 2) */
function sumAmt(lines: string[], labelRe: RegExp, nextLineOnly = false): number {
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue;
    if (!nextLineOnly) {
      const stripped = lines[i].replace(/\([^)]+\)/g, "");
      const m = stripped.match(AMT_RE);
      if (m) { total += parseARS(m[1]); continue; }
    }
    if (i + 1 < lines.length) {
      const m = lines[i + 1].match(/^(-?)(\d{1,3}(?:\.\d{3})*,\d{2})/);
      if (m) total += (m[1] === "-" ? -1 : 1) * parseARS(m[2]);
    }
  }
  return total;
}

/** Find a percentage rate that is on the line AFTER the label, e.g. "TNA $\n80,830 %" */
function findPct(lines: string[], labelRe: RegExp): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue;
    if (i + 1 < lines.length) {
      const m = lines[i + 1].match(/^([\d,.]+)\s*%/);
      if (m) return parsePct(m[1]);
    }
  }
  return undefined;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function parseHeader(text: string, lines: string[]): ParsedHeader {
  // Account number: "Visa Gold cuenta 1078064534"
  const accM = text.match(/cuenta\s+([\d]{6,})/i);
  const accountNumber = accM?.[1];
  // Card last four = last 4 digits of account number
  const cardLastFour = accountNumber?.slice(-4) ?? "0000";

  // Holder name: first all-caps two-word line near top that isn't a label
  let holderName = "Titular BBVA";
  for (const line of lines.slice(0, 20)) {
    if (
      /^[A-ZÁÉÍÓÚÑ]{2,}(\s+[A-ZÁÉÍÓÚÑ]{2,})+$/.test(line) &&
      !/BBVA|VISA|BANCO|LÍMITES|PESOS|DÓLARES|ARGENTINA|OCASA|RESUMEN/i.test(line)
    ) {
      holderName = line.trim();
      break;
    }
  }

  // Dates: label on one line, DD-Mon-YY on the next
  const cierreActM = text.match(/CIERRE\s+ACTUAL[\s\S]{0,20}?(\d{2}-[A-Za-z]{3}-\d{2,4})/i);
  const vencActM   = text.match(/VENCIMIENTO\s+ACTUAL[\s\S]{0,20}?(\d{2}-[A-Za-z]{3}-\d{2,4})/i);
  const cierreAntM = text.match(/CIERRE\s+ANTERIOR[\s\S]{0,20}?(\d{2}-[A-Za-z]{3}-\d{2,4})/i);

  const today = new Date().toISOString().slice(0, 10);
  return {
    bank_name: "BBVA",
    holder_name: holderName,
    account_number: accountNumber,
    card_last_four: cardLastFour,
    card_network: "Visa",
    period_start: (cierreAntM?.[1] && parseDate(cierreAntM[1])) ?? today,
    period_end:   (cierreActM?.[1]  && parseDate(cierreActM[1]))  ?? today,
    due_date:     (vencActM?.[1]    && parseDate(vencActM[1]))    ?? today,
  };
}

// ─── Balance ──────────────────────────────────────────────────────────────────

function parseBalance(lines: string[]): ParsedBalanceSummary {
  // "DB IVA $ 21%" and "IIBB PERCEP" lines have the base amount on the SAME line
  // and the actual tax on the NEXT line → nextLineOnly=true
  const ivaTax  = sumAmt(lines, /DB\s+IVA\s+\$/i,    true)
                + sumAmt(lines, /IVA\s+RG\s+\d/i,    true);
  const iibbTax = sumAmt(lines, /IIBB\s+PERCEP/i,    true)
                + sumAmt(lines, /DB\.RG/i,            true);
  const selloTax = sumAmt(lines, /IMPUESTO\s+DE\s+SELLOS/i, true);

  // "SALDO ACTUAL U$S\nX,XX" → USD balance
  let currentBalanceUsd: number | undefined;
  for (let i = 0; i < lines.length; i++) {
    if (/^SALDO\s+ACTUAL\s+U\$S$/i.test(lines[i]) && i + 1 < lines.length) {
      const m = lines[i + 1].match(/^(\d{1,3}(?:\.\d{3})*,\d{2})/);
      if (m) { currentBalanceUsd = parseARS(m[1]); break; }
    }
  }

  return {
    currency: "ARS",
    // "SALDO ANTERIOR628.955,942,99" — no space before amount, same-line extraction
    previous_balance:       findAmt(lines, /SALDO\s+ANTERIOR/i),
    // "SU PAGO EN PESOS\n-300.000,00" — negative amount on next line
    payments_applied:       findAmt(lines, /SU\s+PAGO\s+EN\s+PESOS/i,       true),
    // "TOTAL CONSUMOS DE TOMAS GONCALVES\n570.498,282,99" — first AMT on next line
    total_consumption:      findAmt(lines, /TOTAL\s+CONSUMOS/i,              true),
    commission_cuenta_full: findAmt(lines, /COMISI[OÓ]N\s+CUENTA\s+FULL/i,  true),
    sello_tax:              selloTax,
    iva_tax:                ivaTax,
    iibb_tax:               iibbTax,
    financing_interest:     findAmt(lines, /INTERESES\s+FINANCIACION/i,      true),
    // Standalone "SALDO ACTUAL" line (no $ or U$S suffix) → next line is ARS balance
    current_balance:        findAmt(lines, /^SALDO\s+ACTUAL$/i,              true),
    current_balance_usd:    currentBalanceUsd,
    minimum_payment:        findAmt(lines, /PAGO\s+M[IÍ]NIMO/i,             true),
    tna_ars: findPct(lines, /^TNA\s+\$$/i),
    tem_ars: findPct(lines, /^TEM\s+\$$/i),
    tea_ars: findPct(lines, /^TEA\s+\$$/i),
  };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

// BBVA PDF format: date on its own line, description on next, amount on the line after.
const DATE_ONLY   = /^(\d{2}[\/\-](?:\d{2}|[A-Za-z]{3})[\/\-]\d{2,4})$/;
const DATE_INLINE = /^(\d{2}[\/\-](?:\d{2}|[A-Za-z]{3})[\/\-]\d{2,4})\s+(.+)/;
const INSTALLMENT = /\b(?:CTA\s+)?(\d{1,2})\/(\d{1,2})\b/;
const TRAILING_AMT = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
const TRAILING_NUM = /\s(\d{6,})$/;
const AMT_ONLY    = /^(-?)(\d{1,3}(?:\.\d{3})*,\d{2})(?:[^,\d].*)?$/;

// Lines to skip when they appear as the description of a parsed 3-line block
const DESC_SKIP = /^(FECHA|DESCRIPC|IMPORTE|TOTAL|SU PAGO|TRANSFERENCIA DEUDA|IMPUESTO|INTERESES|COMISION|IVA|IIBB|DB\s|SALDO|Legales|Canales|Sobre\s)/i;

// Section markers
const SECTION_CONSUME_START = /^Consumos\s+\w/i;
const SECTION_CONSUME_END   = /^Impuestos,?\s+cargos/i;

function extractTx(
  date: string,
  descLine: string,
  amtLine: string,
): ParsedTransaction | null {
  const rest0 = descLine.trim();
  if (DESC_SKIP.test(rest0) || rest0.length < 2) return null;

  let amount_ars: number;
  let amount_usd: number | undefined;

  // Try dedicated amount line first
  const amtM = amtLine?.match(AMT_ONLY);
  if (amtM) {
    amount_ars = (amtM[1] === "-" ? -1 : 1) * parseARS(amtM[2]);
    // Handle dual-currency lines like "4.305,60-2,99"
    const usdPart = amtLine.match(/-(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/);
    if (usdPart) amount_usd = parseARS(usdPart[1]);
  } else {
    const trailingM = rest0.match(TRAILING_AMT);
    if (!trailingM) return null;
    amount_ars = parseARS(trailingM[1]);
  }

  // Skip zero-amount lines that are just headers/totals
  if (amount_ars === 0 && !amount_usd) return null;

  let rest = rest0;
  // Remove amount if it was trailing on the description (fallback path)
  if (!amtLine?.match(AMT_ONLY)) {
    const trailingM = rest.match(TRAILING_AMT);
    if (trailingM) rest = rest.slice(0, rest.lastIndexOf(trailingM[1])).trim();
  }

  // Detect USD transactions from description (e.g. "APPLE.COM BILL ... MT575T ... USD 2,99")
  if (/USD|U\$S/i.test(rest) && amount_ars > 0 && amount_ars < 100) {
    amount_usd = amount_ars;
    amount_ars = 0;
  }

  // Installment: "CTA 06/06" or "06/06"
  let installment_current: number | undefined;
  let installment_total: number | undefined;
  const im = rest.match(INSTALLMENT);
  if (im) {
    installment_current = parseInt(im[1], 10);
    installment_total   = parseInt(im[2], 10);
    rest = rest.replace(im[0], "").trim();
  }

  // Trailing voucher number (6+ digits at end, preceded by space)
  let voucher_number: string | undefined;
  const vm = rest.match(TRAILING_NUM);
  if (vm) {
    voucher_number = vm[1];
    rest = rest.slice(0, rest.lastIndexOf(vm[1])).trim();
  }

  const merchant_name = rest.trim();
  if (!merchant_name || merchant_name.length < 2) return null;

  return {
    date,
    merchant_name,
    voucher_number,
    installment_current,
    installment_total,
    amount_ars,
    amount_usd: amount_usd && amount_usd > 0 ? amount_usd : undefined,
  };
}

function parseTransactions(lines: string[]): ParsedTransaction[] {
  const txs: ParsedTransaction[] = [];
  let inConsumos = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track sections — only include "Consumos" section, skip payments and fees
    if (SECTION_CONSUME_START.test(line)) { inConsumos = true; continue; }
    if (SECTION_CONSUME_END.test(line))   { inConsumos = false; continue; }
    if (!inConsumos) continue;

    // 3-line format: date alone on line i, description on i+1, amount on i+2
    const dm = line.match(DATE_ONLY);
    if (dm) {
      const date = parseDate(dm[1]);
      if (date && i + 2 < lines.length) {
        const tx = extractTx(date, lines[i + 1], lines[i + 2]);
        if (tx) { txs.push(tx); i += 2; continue; }
      }
    }

    // Fallback: inline "date  description  amount" on same line
    const lm = line.match(DATE_INLINE);
    if (lm) {
      const date = parseDate(lm[1]);
      if (!date) continue;
      const tx = extractTx(date, lm[2], "");
      if (tx) txs.push(tx);
    }
  }

  return txs;
}
