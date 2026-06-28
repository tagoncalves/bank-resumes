"use client";

import { RegisterPaymentDialog, type CurrencyBalance } from "./register-payment-dialog";

interface StatementPayButtonProps {
  statementId: string;
  currencies: CurrencyBalance[];
  dueDate: string;
  bankName: string;
  cardLastFour: string;
  periodLabel: string;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
}

export function StatementPayButton(props: StatementPayButtonProps) {
  const { trigger, children, ...rest } = props;
  return (
    <RegisterPaymentDialog {...rest} trigger={trigger ?? children} />
  );
}
