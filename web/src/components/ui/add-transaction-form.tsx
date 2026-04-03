"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type Category = { id: string; name: string };

export function AddTransactionForm({
  statementId,
  categories,
}: {
  statementId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    merchantName: "",
    amountArs: "",
    amountUsd: "",
    categoryId: "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountArs = parseFloat(form.amountArs.replace(",", "."));
    if (!form.merchantName || isNaN(amountArs)) {
      setError("Completá comercio e importe.");
      return;
    }

    const body = {
      statementId,
      date: form.date,
      merchantName: form.merchantName,
      amountArs,
      amountUsd: form.amountUsd ? parseFloat(form.amountUsd.replace(",", ".")) : undefined,
      categoryId: form.categoryId || undefined,
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

    setForm({ date: new Date().toISOString().slice(0, 10), merchantName: "", amountArs: "", amountUsd: "", categoryId: "" });
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
      >
        <Plus className="h-4 w-4" /> Agregar movimiento
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700">Nuevo movimiento manual</p>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
          <X className="h-4 w-4" />
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
          <label className="mb-1 block text-xs text-zinc-500">Comercio</label>
          <input
            type="text"
            value={form.merchantName}
            onChange={(e) => set("merchantName", e.target.value)}
            placeholder="Nombre del comercio"
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

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
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
  );
}
