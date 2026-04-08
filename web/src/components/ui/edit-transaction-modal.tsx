"use client";

import { useState, useTransition, useEffect } from "react";
import { X } from "lucide-react";

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
    date: new Date(transaction.date).toISOString().slice(0, 10),
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

    const amountArs = parseFloat(form.amountArs.replace(",", "."));
    if (!form.merchantName || isNaN(amountArs) || amountArs <= 0) {
      setError("Completá descripción e importe.");
      return;
    }

    const body: Record<string, unknown> = {
      date: form.date,
      merchantName: form.merchantName,
      amountArs,
      amountUsd: form.amountUsd ? parseFloat(form.amountUsd.replace(",", ".")) : null,
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
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <p className="text-sm font-semibold text-zinc-800">Editar movimiento</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
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
                  ? "bg-red-100 text-red-700"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => set("transactionType", "CREDIT")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                form.transactionType === "CREDIT"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              Ingreso
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                required
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Categoría</label>
              <select
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">Descripción</label>
              <input
                type="text"
                value={form.merchantName}
                onChange={(e) => set("merchantName", e.target.value)}
                required
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Importe ARS</label>
              <input
                type="text"
                value={form.amountArs}
                onChange={(e) => set("amountArs", e.target.value)}
                required
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Importe USD</label>
              <input
                type="text"
                value={form.amountUsd}
                onChange={(e) => set("amountUsd", e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
          </div>

          {form.transactionType === "DEBIT" && (
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={form.isInstallment}
                  onChange={(e) => set("isInstallment", e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-300 accent-indigo-600"
                />
                Es en cuotas
              </label>
              {form.isInstallment && (
                <div className="mt-2 flex items-center gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Cuota actual</label>
                    <input
                      type="number"
                      min="1"
                      value={form.installmentCurrent}
                      onChange={(e) => set("installmentCurrent", e.target.value)}
                      className="w-20 rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>
                  <span className="mt-5 text-zinc-400">/</span>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Total cuotas</label>
                    <input
                      type="number"
                      min="2"
                      value={form.installmentTotal}
                      onChange={(e) => set("installmentTotal", e.target.value)}
                      className="w-20 rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
