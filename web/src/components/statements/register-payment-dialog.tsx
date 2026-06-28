"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Check, CreditCard, DollarSign } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { todayInputValue } from "@/lib/dates";
import { formatARS, formatUSD } from "@/lib/formatters";
import { formatMoneyInput, parseMoneyInput, parseMoneyNumber } from "@/lib/money-input";

export interface CurrencyBalance {
  code: string;
  total: number;
  minimum: number;
  paid: number;
}

interface RegisterPaymentDialogProps {
  statementId: string;
  currencies: CurrencyBalance[];
  dueDate: string;
  bankName: string;
  cardLastFour: string;
  periodLabel: string;
  trigger?: React.ReactNode;
}

interface SearchTx {
  id: string;
  date: string;
  merchantName: string;
  amountArs: number;
  amountUsd: number | null;
  transactionType: string;
}

function fmtAmount(amount: number, code: string): string {
  if (code === "ARS") return formatARS(amount);
  if (code === "USD") return formatUSD(amount);
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: code }).format(amount);
}

export function RegisterPaymentDialog({
  statementId,
  currencies,
  dueDate,
  bankName,
  cardLastFour,
  periodLabel,
  trigger,
}: RegisterPaymentDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const hasMultipleCurrencies = currencies.length > 1;
  const [open, setOpen] = useState(false);
  const [currencyCode, setCurrencyCode] = useState(currencies[0]?.code ?? "ARS");
  const [amountMode, setAmountMode] = useState<"total" | "pending" | "minimum" | "custom">("total");
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

  const balance = currencies.find((c) => c.code === currencyCode) ?? currencies[0];
  const totalForCurrency = balance?.total ?? 0;
  const minForCurrency = (balance?.minimum ?? 0) > 0 ? balance.minimum : null;
  const paidForCurrency = balance?.paid ?? 0;
  const pendingForCurrency = Math.max(0, totalForCurrency - paidForCurrency);
  const hasPayments = pendingForCurrency < totalForCurrency;

  function selectTransactionAmount(tx: SearchTx): number {
    if (currencyCode === "ARS") return tx.amountArs;
    if (currencyCode === "USD") return tx.amountUsd ?? tx.amountArs;
    return tx.amountArs;
  }

  function getAmount(): number {
    if (selectedTransaction) return selectTransactionAmount(selectedTransaction);
    if (amountMode === "total") return totalForCurrency;
    if (amountMode === "pending" && pendingForCurrency > 0) return pendingForCurrency;
    if (amountMode === "minimum" && minForCurrency != null) return minForCurrency;
    return parseMoneyNumber(customAmount);
  }

  const amount = getAmount();
  const valid = description.trim() && amount > 0;

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
    setCustomAmount(String(selectTransactionAmount(tx)));
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
    setAmountMode("total");
    setSearchQuery("");
  }

  function switchCurrency(code: string) {
    setCurrencyCode(code);
    setAmountMode("total");
    setCustomAmount("");
    setSelectedTransaction(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!description.trim() || amount <= 0) {
      setError("Completá descripción e importe.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        statementId,
        date,
        merchantName: description.trim(),
        transactionType: "DEBIT",
        amountArs: 0,
      };

      if (currencyCode === "ARS") {
        body.amountArs = amount;
      } else if (currencyCode === "USD") {
        body.amountUsd = amount;
      } else {
        body.amountArs = amount;
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al registrar el pago" }));
        throw new Error(err.error);
      }

      showToast({
        tone: "success",
        title: "Pago registrado",
        description: `${fmtAmount(amount, currencyCode)} · ${description.trim()}`,
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
      setCurrencyCode(currencies[0]?.code ?? "ARS");
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

  const displayAmount = amountMode === "total"
    ? fmtAmount(totalForCurrency, currencyCode)
    : amountMode === "pending"
    ? fmtAmount(pendingForCurrency, currencyCode)
    : amountMode === "minimum" && minForCurrency != null
    ? fmtAmount(minForCurrency, currencyCode)
    : selectedTransaction
    ? fmtAmount(amount, currencyCode)
    : customAmount
    ? fmtAmount(parseMoneyNumber(customAmount), currencyCode)
    : null;

  return (
    <>
      {trigger ? (
        <span
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="cursor-pointer"
        >
          {trigger}
        </span>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50"
        >
          <CreditCard className="h-4 w-4" /> Registrar pago
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Registrar pago</p>
                <p className="text-xs text-zinc-500">
                  {bankName} · •••• {cardLastFour} · {periodLabel}
                </p>
                {hasPayments && (
                  <p className="mt-1 text-xs text-zinc-500">
                    <span className="text-emerald-600">Pagado: {fmtAmount(paidForCurrency, currencyCode)}</span>
                    {" · "}
                    <span className="text-zinc-600">Pendiente: {fmtAmount(pendingForCurrency, currencyCode)}</span>
                  </p>
                )}
              </div>
              <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {/* Currency selector */}
              {hasMultipleCurrencies && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-500">Moneda</label>
                  <div className="flex gap-2">
                    {currencies.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => switchCurrency(c.code)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          currencyCode === c.code
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                        }`}
                      >
                        <DollarSign className="h-3 w-3" />
                        {c.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500">
                  Monto {currencyCode}
                  {totalForCurrency > 0 && (
                    <span className="ml-2 text-zinc-400 font-normal">
                      (Total: {fmtAmount(totalForCurrency, currencyCode)})
                    </span>
                  )}
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAmountMode("total"); setSelectedTransaction(null); }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      amountMode === "total"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    Total
                  </button>
                  {hasPayments && pendingForCurrency > 0 && (
                    <button
                      type="button"
                      onClick={() => { setAmountMode("pending"); setSelectedTransaction(null); }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        amountMode === "pending"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}
                    >
                      Pendiente
                    </button>
                  )}
                  {minForCurrency != null && (
                    <button
                      type="button"
                      onClick={() => { setAmountMode("minimum"); setSelectedTransaction(null); }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        amountMode === "minimum"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}
                    >
                      Mínimo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAmountMode("custom")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      amountMode === "custom"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    Otro
                  </button>
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
                        {displayAmount ?? "—"}
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
                        {fmtAmount(amount, currencyCode)}
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
                              <p className="text-xs text-red-600">
                                {formatARS(tx.amountArs)}
                                {tx.amountUsd != null ? ` / ${formatUSD(tx.amountUsd)}` : ""}
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
