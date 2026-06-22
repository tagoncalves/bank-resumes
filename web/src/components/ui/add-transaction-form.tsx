"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { dateInputValue, todayInputValue } from "@/lib/dates";
import { formatARS, formatUSD } from "@/lib/formatters";
import { advanceRecurringDate, formatOccurrenceDates, generateOccurrenceDates } from "@/lib/recurring/schedule";
import { formatMoneyInput, parseMoneyInput, parseMoneyNumber } from "@/lib/money-input";

type Category = { id: string; name: string };

const RECURRENCE_OPTIONS = [
  { label: "Semanal", frequency: "WEEKLY", interval: "1" },
  { label: "Quincenal", frequency: "WEEKLY", interval: "2" },
  { label: "Mensual", frequency: "MONTHLY", interval: "1" },
  { label: "Bimestral", frequency: "MONTHLY", interval: "2" },
  { label: "Trimestral", frequency: "MONTHLY", interval: "3" },
  { label: "Semestral", frequency: "MONTHLY", interval: "6" },
  { label: "Anual", frequency: "YEARLY", interval: "1" },
];

type Preview = {
  count: number;
  dates: string[];
  hasMore: boolean;
  totalArs: number;
  totalUsd: number | null;
  capped: boolean;
};

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

const TODAY = () => todayInputValue();
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
  createRecurring: false,
  recurringNextRunAt: TODAY(),
  recurringFrequency: "MONTHLY",
  recurringInterval: "1",
  recurringReminderDaysBefore: "3",
  recurringRequiresConfirmation: true,
  recurringBackfill: false,
  recurringBackfillFrom: TODAY(),
  recurringBackfillTo: TODAY(),
  recurringBackfillMode: "PENDING_CONFIRMATION" as "CREATE_TRANSACTIONS" | "PENDING_CONFIRMATION",
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
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM());
  const [preview, setPreview] = useState<Preview | null>(null);

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
      createRecurring: false,
      recurringNextRunAt: TODAY(),
      recurringFrequency: "MONTHLY",
      recurringInterval: "1",
      recurringReminderDaysBefore: "3",
      recurringRequiresConfirmation: true,
      recurringBackfill: false,
      recurringBackfillFrom: TODAY(),
      recurringBackfillTo: TODAY(),
      recurringBackfillMode: "PENDING_CONFIRMATION",
    });
    setOpen(true);
    setError(null);
  }, [prefill]);

  useEffect(() => {
    if (open && categories.length === 0) {
      fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
    }
  }, [open, categories.length]);

  useEffect(() => {
    if (!form.date) return;
    setForm((current) => ({
      ...current,
      recurringNextRunAt: dateInputValue(
        advanceRecurringDate(current.date, current.recurringFrequency, current.recurringInterval, current.date),
      ),
    }));
  }, [form.date, form.recurringFrequency, form.recurringInterval]);

  useEffect(() => {
    if (!form.createRecurring || !form.recurringBackfill || !form.recurringBackfillFrom || !form.recurringBackfillTo) {
      setPreview(null);
      return;
    }

    const dates = generateOccurrenceDates({
            anchorDate: form.date,
      frequency: form.recurringFrequency,
      interval: Number(form.recurringInterval),
      from: form.recurringBackfillFrom,
      to: form.recurringBackfillTo,
      max: 121,
    });
    const count = Math.min(dates.length, 120);
    const amountArs = parseMoneyNumber(form.amountArs);
    const amountUsd = form.amountUsd ? parseMoneyNumber(form.amountUsd) : null;
    setPreview({
      count,
      dates: formatOccurrenceDates(dates.slice(0, 12)),
      hasMore: dates.length > 12,
      totalArs: Number.isFinite(amountArs) ? amountArs * count : 0,
      totalUsd: amountUsd != null && Number.isFinite(amountUsd) ? amountUsd * count : null,
      capped: dates.length > 120,
    });
  }, [form.createRecurring, form.recurringBackfill, form.recurringBackfillFrom, form.recurringBackfillTo, form.recurringNextRunAt, form.recurringFrequency, form.recurringInterval, form.amountArs, form.amountUsd]);

  function handleClose() {
    setOpen(false);
    setForm(EMPTY_FORM());
    setError(null);
    onPrefillConsumed?.();
  }

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submitForm(mode: "close" | "continue") {
    setError(null);
    setSaving(true);

    const amountArs = parseMoneyNumber(form.amountArs);
    if (!form.merchantName || isNaN(amountArs) || amountArs <= 0) {
      setError("Completá descripción e importe (debe ser mayor a 0).");
      setSaving(false);
      return;
    }

    if (form.isInstallment) {
      const cur = parseInt(form.installmentCurrent, 10);
      const tot = parseInt(form.installmentTotal, 10);
      if (isNaN(cur) || isNaN(tot) || cur < 1 || tot < 2 || cur > tot) {
        setError("Cuotas inválidas: la cuota actual debe ser ≤ al total.");
        setSaving(false);
        return;
      }
    }

    if (form.createRecurring && form.recurringBackfill && (!form.recurringBackfillFrom || !form.recurringBackfillTo)) {
      setError("Completá el rango de carga retrospectiva.");
      setSaving(false);
      return;
    }

    const body = {
      date: form.date,
      merchantName: form.merchantName,
      amountArs,
      amountUsd: form.amountUsd ? parseMoneyNumber(form.amountUsd) : undefined,
      categoryId: form.categoryId || undefined,
      transactionType: form.transactionType,
      isInstallment: form.isInstallment,
      installmentCurrent: form.isInstallment ? parseInt(form.installmentCurrent, 10) : undefined,
      installmentTotal: form.isInstallment ? parseInt(form.installmentTotal, 10) : undefined,
      recurring: form.createRecurring
        ? {
            enabled: true,
            anchorDate: form.date,
            nextRunAt: form.recurringNextRunAt,
            frequency: form.recurringFrequency,
            interval: parseInt(form.recurringInterval, 10) || 1,
            reminderDaysBefore: parseInt(form.recurringReminderDaysBefore, 10) || 3,
            requiresConfirmation: form.recurringRequiresConfirmation,
            backfill: form.recurringBackfill
              ? {
                  enabled: true,
                  from: form.recurringBackfillFrom,
                  to: form.recurringBackfillTo,
                  mode: form.recurringBackfillMode,
                }
              : undefined,
          }
        : undefined,
    };

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Error al guardar el movimiento.");
      setSaving(false);
      return;
    }

    showToast({
      tone: "success",
      title: "Movimiento guardado",
      description: mode === "continue" ? "Podés seguir cargando más movimientos." : undefined,
    });

    setForm({
      ...EMPTY_FORM(),
      transactionType: form.transactionType,
    });

    if (onSaved) {
      onSaved();
    } else {
      startTransition(() => router.refresh());
    }

    if (mode === "close") {
      setOpen(false);
      onPrefillConsumed?.();
    }

    setSaving(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitForm("close");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <p className="text-sm font-semibold text-zinc-800">Nuevo movimiento</p>
          <div className="flex items-center gap-2">
            <a
              href="/api/transactions/template"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar plantilla XLSX
            </a>
            <button type="button" onClick={handleClose} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5">

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
              onChange={(e) => setForm((current) => ({ ...current, date: e.target.value, recurringBackfillTo: e.target.value }))}
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
              inputMode="decimal"
              value={formatMoneyInput(form.amountArs)}
              onChange={(e) => set("amountArs", parseMoneyInput(e.target.value))}
              placeholder="0"
              required
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Importe USD</label>
            <input
              type="text"
              inputMode="decimal"
              value={formatMoneyInput(form.amountUsd)}
              onChange={(e) => set("amountUsd", parseMoneyInput(e.target.value))}
              placeholder="0"
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

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={form.createRecurring}
              onChange={(e) => set("createRecurring", e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 accent-indigo-600"
            />
            Convertir en recurrente
          </label>
          {form.createRecurring && (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Periodicidad</label>
                  <select
                    value={`${form.recurringFrequency}:${form.recurringInterval}`}
                    onChange={(e) => {
                      const [frequency, interval] = e.target.value.split(":");
                      set("recurringFrequency", frequency);
                      set("recurringInterval", interval);
                    }}
                    className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    {RECURRENCE_OPTIONS.map((option) => (
                      <option key={`${option.frequency}:${option.interval}`} value={`${option.frequency}:${option.interval}`}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Próxima fecha</label>
                  <input
                    type="date"
                    value={form.recurringNextRunAt}
                    onChange={(e) => set("recurringNextRunAt", e.target.value)}
                    className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Recordar días antes</label>
                  <input
                    type="number"
                    min="0"
                    value={form.recurringReminderDaysBefore}
                    onChange={(e) => set("recurringReminderDaysBefore", e.target.value)}
                    className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Modo de carga</label>
                  <div className="flex rounded border border-zinc-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => set("recurringRequiresConfirmation", false)}
                      className={`flex-1 rounded px-2 py-1 text-xs ${!form.recurringRequiresConfirmation ? "bg-emerald-100 text-emerald-700" : "text-zinc-500"}`}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => set("recurringRequiresConfirmation", true)}
                      className={`flex-1 rounded px-2 py-1 text-xs ${form.recurringRequiresConfirmation ? "bg-indigo-100 text-indigo-700" : "text-zinc-500"}`}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-zinc-200 bg-white p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={form.recurringBackfill}
                    onChange={(e) => set("recurringBackfill", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-indigo-600"
                  />
                  Cargar ocurrencias anteriores
                </label>
                {form.recurringBackfill && (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Desde</label>
                        <input
                          type="date"
                          value={form.recurringBackfillFrom}
                          onChange={(e) => set("recurringBackfillFrom", e.target.value)}
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Hasta</label>
                        <input
                          type="date"
                          value={form.recurringBackfillTo}
                          onChange={(e) => set("recurringBackfillTo", e.target.value)}
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">Acción histórica</label>
                        <select
                          value={form.recurringBackfillMode}
                          onChange={(e) => set("recurringBackfillMode", e.target.value as "CREATE_TRANSACTIONS" | "PENDING_CONFIRMATION")}
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        >
                          <option value="PENDING_CONFIRMATION">Dejar pendientes</option>
                          <option value="CREATE_TRANSACTIONS">Crear movimientos ahora</option>
                        </select>
                      </div>
                    </div>
                    {preview && (
                      <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                        <p className="font-medium text-zinc-700">
                          {preview.count} ocurrencia{preview.count === 1 ? "" : "s"} · total estimado {formatARS(preview.totalArs)}
                          {preview.totalUsd != null ? ` / ${formatUSD(preview.totalUsd)}` : ""}
                          {preview.capped ? " · limitado a 120" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submitForm("continue")}
            disabled={saving || pending}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {saving || pending ? "Guardando..." : "Guardar y cargar otro"}
          </button>
          <button
            type="submit"
            disabled={saving || pending}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving || pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
