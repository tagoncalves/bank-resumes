import { parseARS, parsePct } from "./amounts";
import { parseDate } from "./dates";
import type { ParsedStatement, ParsedHeader, ParsedBalanceSummary, ParsedTransaction } from "./types";

export function parseGalicia(text: string, lines: string[]): ParsedStatement {
  return {
    header: parseHeader(text, lines),
    balance_summary: parseBalance(lines),
    transactions: parseTransactions(lines),
    parser_version: "js-1.0.0",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip leading DD-Mon-YY date prefix from a line */
function stripDate(line: string): string {
  return line.replace(/^\d{2}-[A-Za-z]{3}-\d{2}\s*/, "");
}

/** All amounts in a string (parenthesized base amounts stripped first) */
function allAmts(s: string): number[] {
  const stripped = s.replace(/\([^)]+\)/g, "");
  const out: number[] = [];
  const re = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) out.push(parseARS(m[1]));
  return out;
}

/** Last amount in a string (after stripping parenthesized sections) */
function lastAmt(s: string): number {
  const a = allAmts(s);
  return a.length ? a[a.length - 1] : 0;
}

/** Sum last amount of all lines matching label (stripping date prefix) */
function sumLines(lines: string[], labelRe: RegExp): number {
  let total = 0;
  for (const line of lines) {
    const stripped = stripDate(line);
    if (labelRe.test(stripped)) total += lastAmt(stripped);
  }
  return total;
}

// ─── Header ───────────────────────────────────────────────────────────────────

// DD-Mon-YY exactly (no \d{2,4} to avoid "2606" false matches in concatenated date strings)
const GALICIA_DATE_ONLY = /\d{2}-[A-Za-z]{3}-\d{2}/g;

/** Extract period start/end and due date from Galicia header lines.
 *  Line format: "26-Feb-2606-Mar-2626-Mar-26" (3 dates concatenated), next line = due date.
 */
function extractHeaderDates(lines: string[], today: string) {
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const matches: string[] = [];
    let dm: RegExpExecArray | null;
    GALICIA_DATE_ONLY.lastIndex = 0;
    while ((dm = GALICIA_DATE_ONLY.exec(lines[i])) !== null) matches.push(dm[0]);
    if (matches.length >= 2) {
      const periodStart = parseDate(matches[0]) ?? today;
      const periodEnd   = parseDate(matches[matches.length - 1]) ?? today;
      let dueDate = today;
      if (i + 1 < lines.length) {
        const dm = lines[i + 1].match(/\d{2}-[A-Za-z]{3}-\d{2}/);
        if (dm) dueDate = parseDate(dm[0]) ?? today;
      }
      return { periodStart, periodEnd, dueDate };
    }
  }
  return { periodStart: today, periodEnd: today, dueDate: today };
}

function parseHeader(text: string, lines: string[]): ParsedHeader {
  const accM = text.match(/N[°º]\s*Cuenta[:\s]+([\d]+)/i);
  const accountNumber = accM?.[1];

  let holderName = "Titular Galicia";
  for (const line of lines.slice(0, 10)) {
    if (
      /^[A-ZÁÉÍÓÚÑ]{2,}(\s+[A-ZÁÉÍÓÚÑ]{2,})+$/.test(line) &&
      !/GALICIA|VISA|BANCO|ARGENTINA/i.test(line)
    ) {
      holderName = line.trim();
      break;
    }
  }

  // Primary card = the last "TARJETA XXXX Total Consumos" in the statement
  let cardLastFour = "0000";
  for (const line of lines) {
    const m = line.match(/^TARJETA\s+(\d{4})\s+Total/i);
    if (m) cardLastFour = m[1];
  }

  const today = new Date().toISOString().slice(0, 10);
  const { periodStart, periodEnd, dueDate } = extractHeaderDates(lines, today);

  return {
    bank_name: "Galicia",
    holder_name: holderName,
    account_number: accountNumber,
    card_last_four: cardLastFour,
    card_network: "Visa",
    period_start: periodStart,
    period_end:   periodEnd,
    due_date:     dueDate,
  };
}

// ─── Balance ──────────────────────────────────────────────────────────────────

function parseBalance(lines: string[]): ParsedBalanceSummary {
  // "SALDO ANTERIOR877.776,0824,06" → first AMT=ARS, second=USD
  let previousBalance = 0;
  let previousBalanceUsd: number | undefined;
  for (const line of lines) {
    if (/SALDO\s+ANTERIOR/i.test(line)) {
      const amts = allAmts(stripDate(line).replace(/SALDO\s+ANTERIOR/i, ""));
      if (amts.length >= 1) previousBalance = amts[0];
      if (amts.length >= 2) previousBalanceUsd = amts[1];
      break;
    }
  }

  // "TOTAL A PAGAR\n1.642.298,3523,99" → current balance ARS + USD
  let currentBalance = 0;
  let currentBalanceUsd: number | undefined;
  for (let i = 0; i < lines.length; i++) {
    if (/^TOTAL\s+A\s+PAGAR$/i.test(lines[i]) && i + 1 < lines.length) {
      const amts = allAmts(lines[i + 1]);
      if (amts.length >= 1) currentBalance = amts[0];
      if (amts.length >= 2) currentBalanceUsd = amts[1];
      break;
    }
  }

  // "06-03-26 SU PAGO EN PESOS -350.000,00"
  let paymentsApplied = 0;
  for (const line of lines) {
    if (/SU\s+PAGO\s+EN\s+PESOS/i.test(line)) {
      const amts = allAmts(stripDate(line));
      if (amts.length) { paymentsApplied = Math.abs(amts[amts.length - 1]); break; }
    }
  }

  // Total consumption: sum of "TARJETA XXXX Total Consumos" first AMT
  let totalConsumption = 0;
  for (const line of lines) {
    if (/^TARJETA\s+\d{4}\s+Total\s+Consumos/i.test(line)) {
      const amts = allAmts(line);
      if (amts.length) totalConsumption += amts[0];
    }
  }

  // Taxes (strip parens, last amt = actual tax)
  const selloTax        = sumLines(lines, /IMPUESTO\s+DE\s+SELLOS/i);
  const ivaTax          = sumLines(lines, /DB\s+IVA\s+\$/i)
                        + sumLines(lines, /IVA\s+RG\s+\d/i);
  const iibbTax         = sumLines(lines, /IIBB\s+PERCEP/i)
                        + sumLines(lines, /DB\.RG/i);
  const financingInterest = sumLines(lines, /INTERESES\s+FINANCIACION/i);

  // Minimum payment: scan lines for "$ X" after the PAGO MINIMO label
  let minimumPayment = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/PAGO\s+MINIMO/i.test(lines[i])) {
      for (let j = i; j <= i + 3 && j < lines.length; j++) {
        const m = lines[j].match(/\$\s*([\d.]+,\d{2})/);
        if (m) { minimumPayment = parseARS(m[1]); break; }
      }
      if (minimumPayment) break;
    }
  }

  // Interest rates: "Nominal Anual\nEn pesos X%  En dólares Y%"
  //                  "Efectiva mensual\nEn pesos X%  En dólares Y%"
  let tnaArs: number | undefined, tnaUsd: number | undefined;
  let temArs: number | undefined, temUsd: number | undefined;
  for (let i = 0; i + 1 < lines.length; i++) {
    if (/Nominal\s+Anual/i.test(lines[i])) {
      const next = lines[i + 1];
      const pm = next.match(/En\s+pesos\s+([\d,.]+)%/i);
      const um = next.match(/En\s+d[oó]lares\s+([\d,.]+)%/i);
      if (pm) tnaArs = parsePct(pm[1]);
      if (um) tnaUsd = parsePct(um[1]);
    }
    if (/Efectiva\s+mensual/i.test(lines[i])) {
      const next = lines[i + 1];
      const pm = next.match(/En\s+pesos\s+([\d,.]+)%/i);
      const um = next.match(/En\s+d[oó]lares\s+([\d,.]+)%/i);
      if (pm) temArs = parsePct(pm[1]);
      if (um) temUsd = parsePct(um[1]);
    }
  }

  return {
    currency: "ARS",
    previous_balance:       previousBalance,
    previous_balance_usd:   previousBalanceUsd,
    payments_applied:       paymentsApplied,
    total_consumption:      totalConsumption,
    commission_cuenta_full: 0,
    sello_tax:              selloTax,
    iva_tax:                ivaTax,
    iibb_tax:               iibbTax,
    financing_interest:     financingInterest,
    current_balance:        currentBalance,
    current_balance_usd:    currentBalanceUsd,
    minimum_payment:        minimumPayment,
    tna_ars: tnaArs,
    tem_ars: temArs,
    tna_usd: tnaUsd,
    tem_usd: temUsd,
  };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

// Transaction dates in Galicia use numeric months: DD-MM-YY (e.g. "28-10-25")
const GALICIA_DATE  = /^(\d{2}-\d{2}-\d{2,4})/;
// No trailing \b — installments in Galicia are often concatenated with voucher+amount (e.g. "02/0300248858.300,00")
const INSTALLMENT   = /\b(\d{1,2})\/(\d{2})/;
const PURE_DIGITS   = /^\d{4,8}$/;
const PURE_AMT      = /^(-?)(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const ENDS_WITH_AMT = /,\d{2}$/;
// 6-digit voucher concatenated directly with amount (e.g. "00248858.300,00")
const VOUCHER6_AMT  = /\s?(\d{6})(\d{1,3}(?:\.\d{3})*,\d{2})$/;
// Space + amount (voucher already separated)
const SPACE_AMT     = /\s(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const AMT_ONLY      = /(\d{1,3}(?:\.\d{3})*,\d{2})$/;

const SKIP_MERCHANT = /^(FECHA|DESCRIPC|IMPORTE|TOTAL\s+A|TARJETA\s+\d|DETALLE|CONSOLIDADO|SALDO|SU\s+PAGO|IMPUESTO|INTERESES|DB[\s.]+|IIBB|IVA\s+RG|PAGO\s+MIN)/i;

/** Strip channel prefix (KDLO*, K*, E*, or bare *) from merchant string */
function extractMerchant(raw: string): string {
  return raw
    .replace(/^(?:[A-Z]{1,4})?\*/, "") // e.g. "KDLO*..." → "...", "*NIKE..." → "NIKE..."
    .replace(/\s+/g, " ")
    .trim();
}

function parseInlineTx(
  date: string,
  rest: string,
  currentCard: string | undefined,
): ParsedTransaction | null {
  let s = rest.trim();

  // USD transaction: "...USD 20,00..." — extract USD amount first
  let amount_usd: number | undefined;
  const usdM = s.match(/USD\s+([\d,.]+)/i);
  if (usdM) {
    amount_usd = parseARS(usdM[1]);
    s = s.replace(/USD\s+[\d,.]+/i, "").trim();
  }

  // Extract installment
  let installment_current: number | undefined;
  let installment_total: number | undefined;
  const im = s.match(INSTALLMENT);
  if (im) {
    installment_current = parseInt(im[1], 10);
    installment_total   = parseInt(im[2], 10);
    s = s.replace(im[0], "").trim();
  }

  // Extract voucher (6 digits) + amount at end — handles concatenated "00248858.300,00"
  let amount_ars = 0;
  let voucher_number: string | undefined;

  const v6m = s.match(VOUCHER6_AMT);
  if (v6m) {
    voucher_number = v6m[1];
    amount_ars = parseARS(v6m[2]);
    s = s.slice(0, s.length - v6m[0].length).trim();
  } else {
    const sm = s.match(SPACE_AMT);
    if (sm) {
      amount_ars = parseARS(sm[1]);
      s = s.slice(0, s.length - sm[0].length).trim();
    } else {
      const em = s.match(AMT_ONLY);
      if (!em) return null;
      amount_ars = parseARS(em[1]);
      s = s.slice(0, s.lastIndexOf(em[1])).trim();
    }
  }

  // For pure USD transactions the extracted ARS amount == USD amount (noise) → zero it out
  if (amount_usd && amount_ars === amount_usd) amount_ars = 0;
  if (amount_ars === 0 && !amount_usd) return null;

  const merchant_name = extractMerchant(s);
  if (!merchant_name || merchant_name.length < 2) return null;
  if (SKIP_MERCHANT.test(merchant_name)) return null;

  return {
    date,
    merchant_name,
    voucher_number,
    installment_current,
    installment_total,
    amount_ars,
    amount_usd: amount_usd && amount_usd > 0 ? amount_usd : undefined,
    card_last_four: currentCard,
  };
}

function parseTransactions(lines: string[]): ParsedTransaction[] {
  const txs: ParsedTransaction[] = [];
  let inDetalle = false;
  // batchStart: index in txs[] where the current card's batch begins
  let batchStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^DETALLE\s+DEL\s+CONSUMO/i.test(line)) { inDetalle = true; continue; }
    if (/^TOTAL\s+A\s+PAGAR/i.test(line))       { inDetalle = false; continue; }

    // "TARJETA 9002 Total Consumos ..." → assign card to current batch, then start new batch
    const cardM = line.match(/^TARJETA\s+(\d{4})\s+Total/i);
    if (cardM) {
      const card = cardM[1];
      for (let j = batchStart; j < txs.length; j++) {
        txs[j] = { ...txs[j], card_last_four: card };
      }
      batchStart = txs.length;
      continue;
    }

    if (!inDetalle) continue;

    const dm = line.match(GALICIA_DATE);
    if (!dm) continue;

    const date = parseDate(dm[1]);
    if (!date) continue;

    const rest = line.slice(dm[1].length).trim();
    if (!rest || SKIP_MERCHANT.test(rest)) continue;

    // ── 3-line format: date line has no trailing amount ──────────────────────
    if (!ENDS_WITH_AMT.test(rest) && i + 2 < lines.length) {
      const voucherLine = lines[i + 1];
      const amtLine     = lines[i + 2];
      if (PURE_DIGITS.test(voucherLine) && PURE_AMT.test(amtLine)) {
        const amtM = amtLine.match(PURE_AMT)!;
        const amount_ars = (amtM[1] === "-" ? -1 : 1) * parseARS(amtM[2]);
        if (amount_ars === 0) { i += 2; continue; }

        let s = rest;
        let installment_current: number | undefined;
        let installment_total: number | undefined;
        const im = s.match(INSTALLMENT);
        if (im) {
          installment_current = parseInt(im[1], 10);
          installment_total   = parseInt(im[2], 10);
          s = s.replace(im[0], "").trim();
        }
        const merchant_name = extractMerchant(s);
        if (merchant_name && merchant_name.length >= 2 && !SKIP_MERCHANT.test(merchant_name)) {
          txs.push({
            date,
            merchant_name,
            voucher_number: voucherLine,
            installment_current,
            installment_total,
            amount_ars,
            card_last_four: undefined, // will be assigned when TARJETA total is found
          });
        }
        i += 2;
        continue;
      }
    }

    // ── Inline format: amount at end of line ─────────────────────────────────
    if (ENDS_WITH_AMT.test(rest)) {
      const tx = parseInlineTx(date, rest, undefined);
      if (tx) txs.push(tx);
    }
  }

  return txs;
}
