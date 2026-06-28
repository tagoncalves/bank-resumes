"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Check, CreditCard } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { todayInputValue } from "@/lib/dates";
import { formatARS } from "@/lib/formatters";
import { formatMoneyInput, parseMoneyInput, parseMoneyNumber } from "@/lib/money-input";

interface RegisterPaymentDialogProps {
  statementId: string;
  currentBalance: number;
  minimumPayment: number;
  dueDate: string;
  bankName: string;
  cardLastFour: string;
  periodLabel: string;
}

interface SearchTx {
  id: string;
  date: string;
  merchantName: string;
  amountArs: number;
  amountUsd: number | null;
  transactionType: string;
}

export function RegisterPaymentDialog({
  statementId,
  currentBalance,
  minimumPayment,
  dueDate,
  bankName,
  cardLastFour,
  periodLabel,
}: RegisterPaymentDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [amountMode, setAmountMode] = useState<"total" | "minimum" | "custom">("total");
  const [customAmount, setCustomAmount] = useState("");
  const [description, setDescription] = useState(`Pago ${bankName} •••• ${cardLastFour}`);
  const [date, setDate] = useState(todayInputValue());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchTx[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<SearchTx | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAmountFilled = amountMode !== "custom" || selectedTransaction || (parseMoneyNumber(customAmount) > 0);

  function getAmount(): number {
    if (amountMode === "total") return currentBalance;
    if (amountMode === "minimum") return minimumPayment;
    if (selectedTransaction) return selectedTransaction.amountArs;
    return parseMoneyNumber(customAmount);
  }

  const displayAmount = getAmount();
  const valid = description.trim() && displayAmount > 0;

  useEffect(() => {
    if (!open) return;
    if (!searchQuery.trim() || selectedTransaction) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      if (!searchQuery.trim()) return;
      setSearching(true);
      try {
        const res = await fetch(`/api/transactions?search=${encodeURIComponent(searchQuery.trim())}&limit=8&sortBy=date&sortOrder=desc`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.data ?? []);
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, selectedTransaction, open]);

  function handleSelectTransaction(tx: SearchTx) {
    setSelectedTransaction(tx);
    setDescription(tx.merchantName);
    setCustomAmount(String(tx.amountArs));
    if (amountMode === "total" || amountMode === "minimum") {
      setAmountMode("custom");
    }
    setSearchQuery("");
    setSearchResults([]);
  }

  function handleClearSelected() {
    setSelectedTransaction(null);
    setDescription(`Pago ${bankName} •••• ${cardLastFour}`);
    setCustomAmount("");
    setSearchQuery("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = getAmount();
    if (!description.trim() || amount <= 0) {
      setError("Completá descripción e importe.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementId,
          date,
          merchantName: description.trim(),
          amountArs: amount,
          transactionType: "CREDIT",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al registrar el pago" }));
        throw new Error(err.error);
      }

      showToast({
        tone: "success",
        title: "Pago registrado",
        description: `${formatARS(amount)} · ${description.trim()}`,
      });

      handleClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el pago");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setAmountMode("total");
      setCustomAmount("");
      setDescription(`Pago ${bankName} •••• ${cardLastFour}`);
      setDate(todayInputValue());
      setSearchQuery("");
      setSearchResults([]);
      setSelectedTransaction(null);
      setError(null);
    }, 200);
  }

  const amountDisplay = amountMode === "total"
    ? formatARS(currentBalance)
    : amountMode === "minimum"
    ? formatARS(minimumPayment)
    : selectedTransaction
    ? formatARS(selectedTransaction.amountArs)
    : customAmount
    ? formatARS(parseMoneyNumber(customAmount))
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50"
      >
        <CreditCard className="h-4 w-4" /> Registrar pago
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Registrar pago</p>
                <p className="text-xs text-zinc-500">
                  {bankName} · •••• {cardLastFour} · {periodLabel}
                </p>
              </div>
              <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {/* Amount */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500">Monto</label>
                <div className="flex gap-2">
                  {(["total", "minimum", "custom"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setAmountMode(mode);
                        if (mode !== "custom") setSelectedTransaction(null);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        amountMode === mode
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}
                    >
                      {mode === "total" ? "Total" : mode === "minimum" ? "Mínimo" : "Otro"}
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  {amountMode === "custom" && !selectedTransaction ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatMoneyInput(customAmount)}
                      onChange={(e) => setCustomAmount(parseMoneyInput(e.target.value))}
                      placeholder="Ingresá un importe"
                      className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-lg font-mono focus:outline-none focus:ring-1 focus:ring-emerald-300"
                      autoFocus
                    />
                  ) : (
                    <div className="rounded-md bg-emerald-50 px-3 py-3">
                      <p className="text-center text-lg font-semibold font-mono text-emerald-700 tabular-nums">
                        {amountDisplay ?? "—"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Descripción</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-300"
                />
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Fecha de pago</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-300"
                />
              </div>

              {/* Existing transaction search */}
              <div>
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 border-t border-zinc-200" />
                  <span className="shrink-0 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                    {selectedTransaction ? "Movimiento asociado" : "o asociá un movimiento existente"}
                  </span>
                  <div className="flex-1 border-t border-zinc-200" />
                </div>

                {selectedTransaction ? (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800">
                        {selectedTransaction.merchantName}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatARS(selectedTransaction.amountArs)}
                        {selectedTransaction.amountUsd != null
                          ? ` / ${formatARS(selectedTransaction.amountUsd)} USD`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelected}
                      className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscá por comercio o monto..."
                      className="w-full rounded border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-300"
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
                        {searchResults.map((tx) => (
                          <button
                            key={tx.id}
                            type="button"
                            onClick={() => handleSelectTransaction(tx)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm text-zinc-800">{tx.merchantName}</p>
                              <p className="text-xs text-zinc-400">
                                {formatARS(tx.amountArs)}
                                {tx.transactionType === "CREDIT" ? " (ingreso)" : ""}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !valid}
                  className="rounded bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "Registrando..." : "Registrar pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
