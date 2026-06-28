"use client";

import { useState, useTransition, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateInputValue } from "@/lib/dates";
import { formatMoneyInput, parseMoneyInput, parseMoneyNumber } from "@/lib/money-input";

type Category = { id: string; name: string };

interface TransactionData {
  id: string;
  date: string;
  merchantName: string;
  normalizedMerchant: string;
  amountArs: number;
  amountUsd?: number | null;
  categoryId?: string | null;
  transactionType: string;
  isInstallment: boolean;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
}

export function EditTransactionModal({
  transaction,
  onClose,
  onSaved,
}: {
  transaction: TransactionData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [form, setForm] = useState({
    date: dateInputValue(transaction.date),
    merchantName: transaction.normalizedMerchant || transaction.merchantName,
    amountArs: String(transaction.amountArs),
    amountUsd: transaction.amountUsd ? String(transaction.amountUsd) : "",
    categoryId: transaction.categoryId ?? "",
    transactionType: transaction.transactionType as "DEBIT" | "CREDIT",
    isInstallment: transaction.isInstallment,
    installmentCurrent: String(transaction.installmentCurrent ?? 1),
    installmentTotal: String(transaction.installmentTotal ?? 2),
  });

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountArs = parseMoneyNumber(form.amountArs);
    if (!form.merchantName || isNaN(amountArs) || amountArs <= 0) {
      setError("Completá descripción e importe.");
      return;
    }

    const body: Record<string, unknown> = {
      date: form.date,
      merchantName: form.merchantName,
      amountArs,
      amountUsd: form.amountUsd ? parseMoneyNumber(form.amountUsd) : null,
      categoryId: form.categoryId || null,
      transactionType: form.transactionType,
      isInstallment: form.isInstallment,
      installmentCurrent: form.isInstallment ? parseInt(form.installmentCurrent, 10) : null,
      installmentTotal: form.isInstallment ? parseInt(form.installmentTotal, 10) : null,
    };

    const res = await fetch(`/api/transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Error al guardar los cambios.");
      return;
    }

    startTransition(() => { onSaved(); onClose(); });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ds-panel w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-sm font-semibold text-foreground">Editar movimiento</p>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set("transactionType", "DEBIT")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                form.transactionType === "DEBIT"
                  ? "bg-expense/15 text-expense"
                  : "bg-surface-alt text-muted hover:bg-surface-muted"
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => set("transactionType", "CREDIT")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                form.transactionType === "CREDIT"
                  ? "bg-income/15 text-income"
                  : "bg-surface-alt text-muted hover:bg-surface-muted"
              }`}
            >
              Ingreso
            </button>
          </div>

          <div className="responsive-grid-detail">
            <div>
              <label className="mb-1 block text-xs text-muted">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                required
                className="ds-input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Categoría</label>
              <select
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="ds-input"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">Descripción</label>
              <input
                type="text"
                value={form.merchantName}
                onChange={(e) => set("merchantName", e.target.value)}
                required
                className="ds-input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Importe ARS</label>
              <input
                type="text"
                inputMode="decimal"
                value={formatMoneyInput(form.amountArs)}
                onChange={(e) => set("amountArs", parseMoneyInput(e.target.value))}
                required
                className="ds-input font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Importe USD</label>
              <input
                type="text"
                inputMode="decimal"
                value={formatMoneyInput(form.amountUsd)}
                onChange={(e) => set("amountUsd", parseMoneyInput(e.target.value))}
                placeholder="0"
                className="ds-input font-mono"
              />
            </div>
          </div>

          {form.transactionType === "DEBIT" && (
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={form.isInstallment}
                  onChange={(e) => set("isInstallment", e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                Es en cuotas
              </label>
              {form.isInstallment && (
                <div className="mt-2 flex items-center gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted">Cuota actual</label>
                    <input
                      type="number"
                      min="1"
                      value={form.installmentCurrent}
                      onChange={(e) => set("installmentCurrent", e.target.value)}
                      className="w-20 ds-input font-mono"
                    />
                  </div>
                  <span className="mt-5 text-muted">/</span>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Total cuotas</label>
                    <input
                      type="number"
                      min="2"
                      value={form.installmentTotal}
                      onChange={(e) => set("installmentTotal", e.target.value)}
                      className="w-20 ds-input font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-expense">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
            >
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
