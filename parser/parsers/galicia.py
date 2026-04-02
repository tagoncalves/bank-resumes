import re
import logging
from datetime import date, datetime
from typing import Optional

from parsers.base import BaseStatementParser
from models.schema import ParsedStatement, ParsedHeader, ParsedBalanceSummary, ParsedTransaction
from utils.amount_parser import parse_ars_amount, parse_percentage

logger = logging.getLogger(__name__)


def _parse_date(raw: str) -> Optional[date]:
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


class GaliciaParser(BaseStatementParser):
    """
    Parser for Banco Galicia credit card statements.
    Features:
    - Two physical cards under one account (Tarjeta XXXX)
    - Dual currency (ARS + USD)
    - Complex balance summary layout
    """

    def parse(self) -> ParsedStatement:
        text = self.full_text()
        lines = [l.strip() for l in text.splitlines() if l.strip()]

        header = self._parse_header(lines, text)
        balance = self._parse_balance(text)
        transactions = self._parse_transactions(lines)

        return ParsedStatement(
            header=header,
            balance_summary=balance,
            transactions=transactions,
        )

    def _parse_header(self, lines: list[str], full_text: str) -> ParsedHeader:
        holder_name = ""
        account_number = None
        card_last_four = "0000"
        period_start: Optional[date] = None
        period_end: Optional[date] = None
        due_date: Optional[date] = None

        date_pattern = r"(\d{2}[/\-]\d{2}[/\-]\d{2,4})"

        # Holder name
        for i, line in enumerate(lines):
            if re.search(r"\bSr[./]?\s*|Titular|TITULAR", line, re.IGNORECASE):
                m = re.search(r"(?:Sr\.?\s+|Titular[:\s]+)([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s,]+)", line)
                if m:
                    holder_name = m.group(1).strip().strip(",")
                elif i + 1 < len(lines) and re.match(r"[A-ZÁÉÍÓÚÑ]", lines[i + 1]):
                    holder_name = lines[i + 1].strip()
                if holder_name:
                    break

        # Account number
        m = re.search(r"(?:N[úu]?mero\s+de\s+[Cc]uenta|Cuenta N[°º]?)[:\s]+([\d\-]+)", full_text)
        if m:
            account_number = m.group(1).strip()

        # Primary card last four (first "Tarjeta XXXX" occurrence)
        m = re.search(r"[Tt]arjeta\s+(\d{4})", full_text)
        if m:
            card_last_four = m.group(1)

        # Dates
        m = re.search(r"[Cc]ierre\s+[Aa]nterior[:\s]+" + date_pattern, full_text)
        if m:
            period_start = _parse_date(m.group(1))

        m = re.search(r"[Cc]ierre\s+[Aa]ctual[:\s]+" + date_pattern, full_text)
        if m:
            period_end = _parse_date(m.group(1))

        m = re.search(r"[Vv]encimiento[:\s]+" + date_pattern, full_text)
        if m:
            due_date = _parse_date(m.group(1))

        # Fallback using all dates in document
        if not period_end or not due_date:
            all_dates = [_parse_date(d) for d in re.findall(date_pattern, full_text) if _parse_date(d)]
            if all_dates and not period_end:
                period_end = all_dates[0]
            if len(all_dates) >= 2 and not due_date:
                due_date = all_dates[1]

        today = date.today()
        return ParsedHeader(
            bank_name="Galicia",
            holder_name=holder_name or "Titular Galicia",
            account_number=account_number,
            card_last_four=card_last_four,
            card_network="Visa",
            period_start=period_start or today,
            period_end=period_end or today,
            due_date=due_date or today,
        )

    def _parse_balance(self, full_text: str) -> ParsedBalanceSummary:
        bs = ParsedBalanceSummary()

        amt = r"([\d\.]+,\d{2})"

        def find(pattern: str) -> float:
            m = re.search(pattern, full_text, re.IGNORECASE | re.MULTILINE)
            return parse_ars_amount(m.group(1)) if m else 0.0

        bs.previous_balance = find(r"[Ss]aldo\s+[Aa]nterior[^$\d\n]*" + amt)
        bs.payments_applied = find(r"[Pp]agos?\s+[Rr]ecibidos?[^$\d\n]*" + amt)
        bs.total_consumption = find(r"[Cc]onsumos?[^$\d\n]*" + amt)
        bs.commission_cuenta_full = find(r"[Cc]omisi[oó]n[^$\d\n]*" + amt)
        bs.sello_tax = find(r"[Ss]ello[^$\d\n]*" + amt)
        bs.iva_tax = find(r"IVA[^$\d\n]*" + amt)
        bs.iibb_tax = find(r"IIBB[^$\d\n]*" + amt)
        bs.financing_interest = find(r"[Ii]ntereses?[^$\d\n]*[Ff]inanciamiento[^$\d\n]*" + amt)
        bs.current_balance = find(r"[Ss]aldo\s+[Aa]ctual[^$\d\n]*" + amt)
        bs.minimum_payment = find(r"[Pp]ago\s+[Mm][íi]nimo[^$\d\n]*" + amt)

        # USD balance
        m = re.search(r"[Ss]aldo\s+[Aa]ctual[^$\d\n]*" + amt + r"[^$\d\n]*" + amt, full_text)
        if m:
            bs.current_balance_usd = parse_ars_amount(m.group(2))

        # Interest rates — Galicia has both ARS and USD rates
        # TNA
        tna_matches = re.findall(r"TNA[:\s]+([\d,\.]+)\s*%", full_text, re.IGNORECASE)
        if len(tna_matches) >= 1:
            bs.tna_ars = parse_percentage(tna_matches[0])
        if len(tna_matches) >= 2:
            bs.tna_usd = parse_percentage(tna_matches[1])

        # TEM
        tem_matches = re.findall(r"TEM[:\s]+([\d,\.]+)\s*%", full_text, re.IGNORECASE)
        if len(tem_matches) >= 1:
            bs.tem_ars = parse_percentage(tem_matches[0])
        if len(tem_matches) >= 2:
            bs.tem_usd = parse_percentage(tem_matches[1])

        # TEA
        tea_matches = re.findall(r"TEA[:\s]+([\d,\.]+)\s*%", full_text, re.IGNORECASE)
        if len(tea_matches) >= 1:
            bs.tea_ars = parse_percentage(tea_matches[0])
        if len(tea_matches) >= 2:
            bs.tea_usd = parse_percentage(tea_matches[1])

        return bs

    def _parse_transactions(self, lines: list[str]) -> list[ParsedTransaction]:
        """
        Galicia has two card sections: Tarjeta XXXX.
        Transaction format: DD/MM/YY  MERCHANT  [cuota X/Y]  AMOUNT_ARS  [AMOUNT_USD]
        """
        transactions = []
        current_card: Optional[str] = None

        date_re = re.compile(r"^(\d{2}[/\-]\d{2}[/\-]\d{2,4})\s+(.+)")
        card_re = re.compile(r"[Tt]arjeta\s+(\d{4})")
        amount_re = re.compile(r"([\d\.]+,\d{2})\s*$")
        installment_re = re.compile(r"\b(?:CTA\s+)?(\d+)/(\d+)\b")
        usd_re = re.compile(r"([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s*$")

        for line in lines:
            # Track current card section
            cm = card_re.search(line)
            if cm and not date_re.match(line):
                current_card = cm.group(1)
                continue

            m = date_re.match(line)
            if not m:
                continue

            tx_date = _parse_date(m.group(1))
            if not tx_date:
                continue

            rest = m.group(2).strip()

            # Skip header/footer rows
            if any(skip in rest.upper() for skip in ["FECHA", "DESCRIPCION", "IMPORTE", "TOTAL", "SALDO"]):
                continue

            # Try to extract two amounts (ARS + USD)
            usd_m = usd_re.search(rest)
            amount_usd = None
            if usd_m:
                amount_ars = parse_ars_amount(usd_m.group(1))
                amount_usd = parse_ars_amount(usd_m.group(2))
                rest = rest[: usd_m.start()].strip()
            else:
                am = amount_re.search(rest)
                if not am:
                    continue
                amount_ars = parse_ars_amount(am.group(1))
                rest = rest[: am.start()].strip()

            # Installment
            inst_current = inst_total = None
            im = installment_re.search(rest)
            if im:
                inst_current, inst_total = int(im.group(1)), int(im.group(2))
                rest = rest[: im.start()].strip()

            # Voucher (long number at end)
            voucher = None
            vm = re.search(r"\s(\d{6,})$", rest)
            if vm:
                voucher = vm.group(1)
                rest = rest[: vm.start()].strip()

            merchant = rest.strip()
            if not merchant or len(merchant) < 2:
                continue

            transactions.append(
                ParsedTransaction(
                    date=tx_date,
                    merchant_name=merchant,
                    voucher_number=voucher,
                    installment_current=inst_current,
                    installment_total=inst_total,
                    amount_ars=amount_ars,
                    amount_usd=amount_usd if (amount_usd and amount_usd > 0) else None,
                    card_last_four=current_card,
                )
            )

        return transactions
