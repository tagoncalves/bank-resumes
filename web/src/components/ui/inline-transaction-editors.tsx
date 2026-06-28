"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";

export function TransactionTypePicker({
  transactionId,
  currentType,
}: {
  transactionId: string;
  currentType: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentType === "CREDIT" ? "CREDIT" : "DEBIT");

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextValue = e.target.value === "CREDIT" ? "CREDIT" : "DEBIT";
    setValue(nextValue);
    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionType: nextValue, isInstallment: nextValue === "CREDIT" ? false : undefined }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={pending}
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 ${
        value === "CREDIT" ? "text-income hover:bg-income/10" : "text-expense hover:bg-expense/10"
      }`}
    >
      <option value="DEBIT">gasto</option>
      <option value="CREDIT">ingreso</option>
    </select>
  );
}

export function MerchantNameEditor({
  transactionId,
  currentValue,
}: {
  transactionId: string;
  currentValue: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === currentValue) {
      setValue(currentValue);
      setEditing(false);
      return;
    }

    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantName: trimmed }),
    });

    setEditing(false);
    startTransition(() => router.refresh());
  }

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") {
              setValue(currentValue);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => void save()}
          className="rounded p-1 text-income hover:bg-income/10"
          disabled={pending}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(currentValue);
            setEditing(false);
          }}
          className="rounded p-1 text-muted hover:bg-surface-alt"
          disabled={pending}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-foreground">{currentValue}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded p-1 text-muted hover:bg-surface-alt hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
