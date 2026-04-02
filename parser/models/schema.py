from pydantic import BaseModel
from typing import Optional
from datetime import date


class ParsedTransaction(BaseModel):
    date: date
    merchant_name: str
    voucher_number: Optional[str] = None
    installment_current: Optional[int] = None
    installment_total: Optional[int] = None
    amount_ars: float
    amount_usd: Optional[float] = None
    card_last_four: Optional[str] = None


class ParsedBalanceSummary(BaseModel):
    currency: str = "ARS"
    previous_balance: float = 0
    previous_balance_usd: Optional[float] = None
    payments_applied: float = 0
    total_consumption: float = 0
    commission_cuenta_full: float = 0
    sello_tax: float = 0
    iva_tax: float = 0
    iibb_tax: float = 0
    financing_interest: float = 0
    current_balance: float = 0
    current_balance_usd: Optional[float] = None
    minimum_payment: float = 0
    tna_ars: Optional[float] = None
    tem_ars: Optional[float] = None
    tea_ars: Optional[float] = None
    tna_usd: Optional[float] = None
    tem_usd: Optional[float] = None
    tea_usd: Optional[float] = None


class ParsedHeader(BaseModel):
    bank_name: str
    holder_name: str
    account_number: Optional[str] = None
    card_last_four: str
    card_network: str = "Visa"
    period_start: date
    period_end: date
    due_date: date


class ParsedStatement(BaseModel):
    header: ParsedHeader
    balance_summary: ParsedBalanceSummary
    transactions: list[ParsedTransaction]
    parser_version: str = "1.0.0"
