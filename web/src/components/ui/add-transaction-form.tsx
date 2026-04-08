"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type Category = { id: string; name: string };

export interface TransactionPrefill {
  merchantName: string;
  amountArs: number;
  amountUsd?: number | null;
  categoryId?: string | null;
  transactionType: string;
  isInstallment: boolean;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
}

const TODAY = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = () => ({
  date: TODAY(),
  merchantName: "",
  amountArs: "",
  amountUsd: "",
  categoryId: "",
  transactionType: "DEBIT" as "DEBIT" | "CREDIT",
  isInstallment: false,
  installmentCurrent: "1",
  installmentTotal: "2",
});

export function AddTransactionForm({
  onSaved,
  prefill,
  onPrefillConsumed,
}: {
  onSaved?: () => void;
  prefill?: TransactionPrefill | null;
  onPrefillConsumed?: () => void;
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM());

  // When prefill arrives, open the form and load the data
  useEffect(() => {
    if (!prefill) return;
    setForm({
      date: TODAY(),
      merchantName: prefill.merchantName,
      amountArs: String(prefill.amountArs),
      amountUsd: prefill.amountUsd ? String(prefill.amountUsd) : "",
      categoryId: prefill.categoryId ?? "",
      transactionType: (prefill.transactionType as "DEBIT" | "CREDIT") ?? "DEBIT",
      isInstallment: prefill.isInstallment,
      installmentCurrent: String(prefill.installmentCurrent ?? 1),
      installmentTotal: String(prefill.installmentTotal ?? 2),
    });
    setOpen(true);
    setError(null);
  }, [prefill]);

  useEffect(() => {
    if (open && categories.length === 0) {
      fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
    }
  }, [open, categories.length]);

  function handleClose() {
    setOpen(false);
    setForm(EMPTY_FORM());
    setError(null);
    onPrefillConsumed?.();
  }

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountArs = parseFloat(form.amountArs.replace(",", "."));
    if (!form.merchantName || isNaN(amountArs) || amountArs <= 0) {
      setError("Completá descripción e importe (debe ser mayor a 0).");
      return;
    }

    if (form.isInstallment) {
      const cur = parseInt(form.installmentCurrent, 10);
      const tot = parseInt(form.installmentTotal, 10);
      if (isNaN(cur) || isNaN(tot) || cur < 1 || tot < 2 || cur > tot) {
        setError("Cuotas inválidas: la cuota actual debe ser ≤ al total.");
        return;
      }
    }

    const body = {
      date: form.date,
      merchantName: form.merchantName,
      amountArs,
      amountUsd: form.amountUsd ? parseFloat(form.amountUsd.replace(",", ".")) : undefined,
      categoryId: form.categoryId || undefined,
      transactionType: form.transactionType,
      isInstallment: form.isInstallment,
      installmentCurrent: form.isInstallment ? parseInt(form.installmentCurrent, 10) : undefined,
      installmentTotal: form.isInstallment ? parseInt(form.installmentTotal, 10) : undefined,
    };

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Error al guardar el movimiento.");
      return;
    }

    setForm({
      date: new Date().toISOString().slice(0, 10),
      merchantName: "",
      amountArs: "",
      amountUsd: "",
      categoryId: "",
      transactionType: "DEBIT",
      isInstallment: false,
      installmentCurrent: "1",
      installmentTotal: "2",
    });
    setOpen(false);
    if (onSaved) {
      onSaved();
    } else {
      startTransition(() => router.refresh());
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-indigo-100 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
      >
        <Plus className="h-4 w-4" /> Agregar movimiento
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <form onSubmit={handleSubmit}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">Nuevo movimiento</p>
          <button type="button" onClick={handleClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Type toggle */}
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => { set("transactionType", "DEBIT"); set("isInstallment", false); }}
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
            onClick={() => { set("transactionType", "CREDIT"); set("isInstallment", false); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              form.transactionType === "CREDIT"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            Ingreso
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-zinc-500">
              {form.transactionType === "CREDIT" ? "Descripción" : "Comercio / descripción"}
            </label>
            <input
              type="text"
              value={form.merchantName}
              onChange={(e) => set("merchantName", e.target.value)}
              placeholder={form.transactionType === "CREDIT" ? "Sueldo, aguinaldo, cobro..." : "Nombre del comercio"}
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
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Importe ARS</label>
            <input
              type="text"
              value={form.amountArs}
              onChange={(e) => set("amountArs", e.target.value)}
              placeholder="0.00"
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

        {/* Installments (gastos only) */}
        {form.transactionType === "DEBIT" && (
          <div className="mt-3">
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
                <p className="mt-5 text-xs text-zinc-400">Importe = valor de 1 cuota</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
