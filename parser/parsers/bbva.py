import re
import logging
from datetime import date, datetime
from typing import Optional

from parsers.base import BaseStatementParser
from models.schema import ParsedStatement, ParsedHeader, ParsedBalanceSummary, ParsedTransaction
from utils.amount_parser import parse_ars_amount, parse_percentage

logger = logging.getLogger(__name__)


def _parse_date_arg(raw: str) -> Optional[date]:
    """Parse DD/MM/YY or DD-MM-YY or DD/MM/YYYY."""
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


class BBVAParser(BaseStatementParser):
    """
    Parser for BBVA Argentina credit card statements (Visa Gold).
    The PDF has a clear text layout with labeled rows for the balance summary
    and a table for transactions.
    """

    def parse(self) -> ParsedStatement:
        text = self.full_text()
        lines = [l.strip() for l in text.splitlines() if l.strip()]

        header = self._parse_header(lines)
        balance = self._parse_balance(lines)
        transactions = self._parse_transactions(lines)

        return ParsedStatement(
            header=header,
            balance_summary=balance,
            transactions=transactions,
        )

    def _parse_header(self, lines: list[str]) -> ParsedHeader:
        holder_name = ""
        account_number = None
        card_last_four = "0000"
        period_start: Optional[date] = None
        period_end: Optional[date] = None
        due_date: Optional[date] = None

        full_text = "\n".join(lines)

        # Holder name — look for "Titular:" or "SR/SRA" pattern
        for i, line in enumerate(lines):
            if re.search(r"\bTitular\b", line, re.IGNORECASE):
                # Name might be on same line or next
                m = re.search(r"Titular[:\s]+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]+)", line)
                if m:
                    holder_name = m.group(1).strip()
                elif i + 1 < len(lines):
                    holder_name = lines[i + 1].strip()
                break

        # Account number
        m = re.search(r"N[úu]mero de cuenta[:\s]+([\d\s\-]+)", full_text, re.IGNORECASE)
        if m:
            account_number = m.group(1).strip().replace(" ", "")

        # Card last four — look for **** **** **** XXXX pattern
        m = re.search(r"\*+\s*\*+\s*\*+\s*(\d{4})", full_text)
        if m:
            card_last_four = m.group(1)

        # Dates — look for "Cierre" / "Vencimiento" patterns
        # BBVA format: "26/02/26" or "26-Feb-26"
        date_pattern = r"(\d{2}[/\-]\d{2}[/\-]\d{2,4})"

        # Period end (cierre actual)
        m = re.search(r"[Cc]ierre\s+[Aa]ctual[:\s]+" + date_pattern, full_text)
        if m:
            period_end = _parse_date_arg(m.group(1))

        # Period start (cierre anterior)
        m = re.search(r"[Cc]ierre\s+[Aa]nterior[:\s]+" + date_pattern, full_text)
        if m:
            period_start = _parse_date_arg(m.group(1))

        # Due date (vencimiento)
        m = re.search(r"[Vv]encimiento[:\s]+" + date_pattern, full_text)
        if m:
            due_date = _parse_date_arg(m.group(1))

        # Fallback: find any 3 dates in sequence
        if not period_end or not due_date:
            all_dates = re.findall(date_pattern, full_text)
            parsed_dates = [_parse_date_arg(d) for d in all_dates if _parse_date_arg(d)]
            if len(parsed_dates) >= 2 and not period_end:
                period_end = parsed_dates[0]
            if len(parsed_dates) >= 3 and not due_date:
                due_date = parsed_dates[2]

        today = date.today()
        return ParsedHeader(
            bank_name="BBVA",
            holder_name=holder_name or "Titular BBVA",
            account_number=account_number,
            card_last_four=card_last_four,
            card_network="Visa",
            period_start=period_start or today,
            period_end=period_end or today,
            due_date=due_date or today,
        )

    def _parse_balance(self, lines: list[str]) -> ParsedBalanceSummary:
        full_text = "\n".join(lines)
        bs = ParsedBalanceSummary()

        def find_amount(pattern: str) -> float:
            m = re.search(pattern, full_text, re.IGNORECASE | re.MULTILINE)
            if m:
                return parse_ars_amount(m.group(1))
            return 0.0

        # Argentine amount pattern: digits with dots and comma
        amt = r"([\$\s]*[\d\.]+,\d{2})"

        bs.previous_balance = find_amount(r"[Ss]aldo\s+[Aa]nterior[^$\d]*" + amt)
        bs.payments_applied = find_amount(r"[Pp]agos?\s+[Rr]ecibidos?[^$\d]*" + amt)
        bs.total_consumption = find_amount(r"[Cc]onsumos?[^$\d]*" + amt)
        bs.commission_cuenta_full = find_amount(r"[Cc]omisi[oó]n\s+[Cc]uenta\s+[Ff]ull[^$\d]*" + amt)
        bs.sello_tax = find_amount(r"[Ss]ello[^$\d]*" + amt)
        bs.financing_interest = find_amount(r"[Ii]ntereses?\s+[Ff]inanciamiento[^$\d]*" + amt)
        bs.current_balance = find_amount(r"[Ss]aldo\s+[Aa]ctual[^$\d]*" + amt)
        bs.minimum_payment = find_amount(r"[Pp]ago\s+[Mm][íi]nimo[^$\d]*" + amt)

        # IVA / IIBB combined
        bs.iva_tax = find_amount(r"IVA[^$\d]*" + amt)
        bs.iibb_tax = find_amount(r"IIBB[^$\d]*" + amt)

        # Interest rates
        m = re.search(r"TNA[:\s]+([\d,\.]+)\s*%", full_text, re.IGNORECASE)
        if m:
            bs.tna_ars = parse_percentage(m.group(1))
        m = re.search(r"TEM[:\s]+([\d,\.]+)\s*%", full_text, re.IGNORECASE)
        if m:
            bs.tem_ars = parse_percentage(m.group(1))
        m = re.search(r"TEA[:\s]+([\d,\.]+)\s*%", full_text, re.IGNORECASE)
        if m:
            bs.tea_ars = parse_percentage(m.group(1))

        return bs

    def _parse_transactions(self, lines: list[str]) -> list[ParsedTransaction]:
        """
        BBVA transaction format (each line):
        DD/MM/YY  MERCHANT NAME    [cuota X/Y]  VOUCHER  AMOUNT_ARS  [AMOUNT_USD]
        """
        transactions = []

        # Date pattern to identify transaction rows
        date_re = re.compile(r"^(\d{2}[/\-]\d{2}[/\-]\d{2,4})\s+(.+)")
        # Amount at end of line
        amount_re = re.compile(r"([\d\.]+,\d{2})\s*$")
        # Installment pattern e.g. "3/12" or "CTA 3/12"
        installment_re = re.compile(r"\bCTA\s+(\d+)/(\d+)\b|\b(\d+)/(\d+)\b")

        for line in lines:
            m = date_re.match(line)
            if not m:
                continue

            tx_date = _parse_date_arg(m.group(1))
            if not tx_date:
                continue

            rest = m.group(2).strip()

            # Skip header/footer rows
            if any(skip in rest.upper() for skip in ["FECHA", "DESCRIPCION", "IMPORTE", "TOTAL", "SALDO"]):
                continue

            # Extract amount
            am = amount_re.search(rest)
            if not am:
                continue
            amount_ars = parse_ars_amount(am.group(1))
            rest = rest[: am.start()].strip()

            # Extract installment
            inst_current = inst_total = None
            im = installment_re.search(rest)
            if im:
                if im.group(1):
                    inst_current, inst_total = int(im.group(1)), int(im.group(2))
                else:
                    inst_current, inst_total = int(im.group(3)), int(im.group(4))
                rest = rest[: im.start()].strip()

            # What remains is merchant name + possibly voucher (numeric at end)
            voucher = None
            voucher_m = re.search(r"\s(\d{6,})$", rest)
            if voucher_m:
                voucher = voucher_m.group(1)
                rest = rest[: voucher_m.start()].strip()

            merchant = rest.strip()
            if not merchant:
                continue

            transactions.append(
                ParsedTransaction(
                    date=tx_date,
                    merchant_name=merchant,
                    voucher_number=voucher,
                    installment_current=inst_current,
                    installment_total=inst_total,
                    amount_ars=amount_ars,
                )
            )

        return transactions
