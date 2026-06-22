"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatARS, formatUSD, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { AddTransactionForm, type TransactionPrefill } from "@/components/ui/add-transaction-form";
import { TransactionMenu } from "@/components/ui/transaction-menu";
import { EditTransactionModal } from "@/components/ui/edit-transaction-modal";
import { TransactionFilter } from "@/components/transactions/TransactionFilter";
import { CategoryPicker } from "@/components/ui/category-picker";
import { MerchantNameEditor } from "@/components/ui/inline-transaction-editors";
import { todayInputValue } from "@/lib/dates";

type Category = { id: string; name: string; color: string | null };

interface Transaction {
  id: string;
  date: string;
  merchantName: string;
  normalizedMerchant: string;
  amountArs: number;
  amountUsd?: number | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  cardLastFour?: string | null;
  isInstallment: boolean;
  transactionType: string;
  source: string;
  categoryId?: string | null;
  category?: { name: string; color: string } | null;
  statement?: { bankName: string; periodEnd: string } | null;
  payslip?: { employerName?: string | null; periodLabel?: string | null } | null;
}

type SortField = "date" | "merchantName" | "amountArs" | "category";
type SortOrder = "asc" | "desc";

function SortIcon({ field, sortBy, sortOrder }: { field: SortField; sortBy: SortField; sortOrder: SortOrder }) {
  if (field !== sortBy) return <ChevronsUpDown className="inline h-3 w-3 ml-1 text-zinc-400" />;
  return sortOrder === "asc"
    ? <ChevronUp className="inline h-3 w-3 ml-1 text-indigo-500" />
    : <ChevronDown className="inline h-3 w-3 ml-1 text-indigo-500" />;
}

function TransactionsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentMonth = searchParams.get("month");
  const currentMonths = searchParams.get("months") ? parseInt(searchParams.get("months")!, 10) : 6;
  const categoryIdsStr = searchParams.get("categoryId") ?? "";
  const originStr = searchParams.get("origin") ?? "";
  const typeStr = searchParams.get("type") ?? "";
  const search = searchParams.get("search") ?? "";
  const currency = searchParams.get("currency") ?? "";
  const amountMin = searchParams.get("amountMin") ?? "";
  const amountMax = searchParams.get("amountMax") ?? "";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [debitTotal, setDebitTotal] = useState(0);
  const [creditTotal, setCreditTotal] = useState(0);
  const [debitTotalUsd, setDebitTotalUsd] = useState(0);
  const [creditTotalUsd, setCreditTotalUsd] = useState(0);
  const [netTotal, setNetTotal] = useState(0);
  const [netTotalUsd, setNetTotalUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [prefill, setPrefill] = useState<TransactionPrefill | null>(null);

  function computeDateRange(): { dateFrom: string; dateTo: string } {
    if (currentMonth) {
      const [y, m] = currentMonth.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return {
        dateFrom: `${currentMonth}-01`,
        dateTo: `${currentMonth}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - currentMonths + 1, 1);
    return {
      dateFrom: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`,
      dateTo: todayInputValue(),
    };
  }

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { dateFrom, dateTo } = computeDateRange();
    const params = new URLSearchParams({ page: String(page), limit: "50", sortBy, sortOrder });
    if (search) params.set("search", search);
    params.set("dateFrom", dateFrom);
    params.set("dateTo", dateTo);
    if (categoryIdsStr) params.set("categoryId", categoryIdsStr);
    if (originStr) params.set("origin", originStr);
    if (typeStr) params.set("type", typeStr);
    if (currency) params.set("currency", currency);
    if (amountMin) params.set("amountMin", amountMin);
    if (amountMax) params.set("amountMax", amountMax);
    const res = await fetch(`/api/transactions?${params}`);
    const json = await res.json();
    setTransactions(json.data ?? []);
    setTotal(json.total ?? 0);
    setDebitTotal(json.debitTotal ?? 0);
    setCreditTotal(json.creditTotal ?? 0);
    setDebitTotalUsd(json.debitTotalUsd ?? 0);
    setCreditTotalUsd(json.creditTotalUsd ?? 0);
    setNetTotal(json.netTotal ?? 0);
    setNetTotalUsd(json.netTotalUsd ?? 0);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, sortBy, sortOrder, currentMonth, currentMonths, categoryIdsStr, originStr, typeStr, currency, amountMin, amountMax]);

  useEffect(() => {
    const id = setTimeout(fetchTransactions, 300);
    return () => clearTimeout(id);
  }, [fetchTransactions]);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, sortOrder, currentMonth, currentMonths, categoryIdsStr, originStr, typeStr, currency, amountMin, amountMax]);

  function updateFilterParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    const query = sp.toString();
    router.replace(query ? `/transactions?${query}` : "/transactions", { scroll: false });
  }

  function handleSort(field: SortField) {
    if (field === sortBy) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "amountArs" ? "desc" : "asc");
    }
  }

  function extractSearchTerm(name: string): string {
    const words = name.trim().split(/\s+/);
    const meaningful = words.filter(
      (w) => !/^\d{4,}/.test(w) && !/^[A-Z0-9]{6,}$/.test(w)
    );
    return (meaningful.slice(0, 3).join(" ").trim()) || name.slice(0, 15).trim();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchTransactions();
  }

  const totalPages = Math.ceil(total / 50);
  const thClass = "px-5 py-2.5 text-left font-medium cursor-pointer select-none hover:text-zinc-700";
  const showingUsdTotals = currency === "USD";
  const shownDebitTotal = showingUsdTotals ? debitTotalUsd : debitTotal;
  const shownCreditTotal = showingUsdTotals ? creditTotalUsd : creditTotal;
  const shownNetTotal = showingUsdTotals ? netTotalUsd : netTotal;
  const formatShownMoney = showingUsdTotals ? formatUSD : formatARS;
  const isNegativeNet = shownNetTotal < 0;
  const activeAdvancedFilters = !!currency || !!amountMin || !!amountMax;

  return (
    <div className="space-y-4">
      {/* Header row: form left, net total right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AddTransactionForm
          onSaved={fetchTransactions}
          prefill={prefill}
          onPrefillConsumed={() => setPrefill(null)}
        />
        <div className="grid w-full grid-cols-3 gap-2 text-right sm:w-auto sm:shrink-0">
          <div className="rounded-lg border border-zinc-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">Gastos</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900">{formatShownMoney(shownDebitTotal)}</p>
          </div>
          <div className="rounded-lg border border-zinc-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">Ingresos</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-emerald-600">+{formatShownMoney(shownCreditTotal)}</p>
          </div>
          <div className="rounded-lg border border-zinc-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">Neto</p>
            <p className={`font-mono text-sm font-semibold tabular-nums ${isNegativeNet ? "text-emerald-600" : "text-zinc-900"}`}>
              {shownNetTotal < 0 ? "+" : shownNetTotal > 0 ? "-" : ""}{formatShownMoney(Math.abs(shownNetTotal))}
            </p>
          </div>
          <p className="col-span-3 text-[10px] text-zinc-400">{total} movimientos en el filtro</p>
        </div>
      </div>

      {/* Filter bar */}
      <TransactionFilter />

      {/* Search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar comercio, banco, categoría o tarjeta..."
              value={search}
              onChange={(e) => updateFilterParam("search", e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white p-1">
            {[
              { label: "ARS", value: "ARS" },
              { label: "USD", value: "USD" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => updateFilterParam("currency", currency === item.value ? "" : item.value)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  currency === item.value ? "bg-indigo-100 text-indigo-700" : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Mín."
            value={amountMin}
            onChange={(e) => updateFilterParam("amountMin", e.target.value)}
            className="w-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Máx."
            value={amountMax}
            onChange={(e) => updateFilterParam("amountMax", e.target.value)}
            className="w-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        {search && (
          <button
            onClick={() => updateFilterParam("search", "")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
          >
            Limpiar búsqueda
          </button>
        )}
        {activeAdvancedFilters && (
          <button
            onClick={() => {
              const sp = new URLSearchParams(searchParams.toString());
              sp.delete("currency");
              sp.delete("amountMin");
              sp.delete("amountMax");
              const query = sp.toString();
              router.replace(query ? `/transactions?${query}` : "/transactions", { scroll: false });
            }}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
          >
            Limpiar filtros de monto
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-zinc-400">Cargando...</div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-zinc-400">Sin resultados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
                  <th className={thClass} onClick={() => handleSort("date")}>
                    Fecha <SortIcon field="date" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th className={thClass} onClick={() => handleSort("merchantName")}>
                    Descripción <SortIcon field="merchantName" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th className="px-5 py-2.5 text-left font-medium">Origen</th>
                  <th className={thClass} onClick={() => handleSort("category")}>
                    Categoría <SortIcon field="category" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium cursor-pointer select-none hover:text-zinc-700" onClick={() => handleSort("amountArs")}>
                    Importe <SortIcon field="amountArs" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const isCredit = t.transactionType === "CREDIT";
                  const canManage = t.source === "MANUAL" || (!t.statement && !t.payslip);
                  return (
                    <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-zinc-500">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          {canManage ? (
                            <MerchantNameEditor
                              transactionId={t.id}
                              currentValue={t.normalizedMerchant || t.merchantName}
                            />
                          ) : (
                            <span className="text-zinc-800">{t.normalizedMerchant || t.merchantName}</span>
                          )}
                          {t.isInstallment && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                              {t.installmentCurrent}/{t.installmentTotal}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-zinc-500">
                        {t.statement ? (
                          <>
                            {t.statement.bankName}
                            {t.cardLastFour && <span className="ml-1 text-zinc-400">·•••{t.cardLastFour}</span>}
                          </>
                        ) : t.payslip ? (
                          <>
                            <span>Recibo</span>
                            {t.payslip.periodLabel && <span className="ml-1 text-zinc-400">· {t.payslip.periodLabel}</span>}
                          </>
                        ) : (
                          <span className="text-zinc-400">Manual</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        <CategoryPicker
                          transactionId={t.id}
                          currentCategoryId={t.categoryId}
                          categories={categories}
                        />
                      </td>
                      <td className={`px-5 py-2.5 text-right font-mono font-medium tabular-nums ${isCredit ? "text-emerald-600" : "text-zinc-800"}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          {t.amountUsd && (
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-600">USD</span>
                          )}
                          {t.amountArs === 0 && t.amountUsd
                            ? formatUSD(t.amountUsd)
                            : `${isCredit ? "+" : ""}${formatARS(t.amountArs)}`}
                        </div>
                      </td>
                      <td className="pr-2 py-2.5">
                        <TransactionMenu
                          onFilter={() => updateFilterParam("search", extractSearchTerm(t.normalizedMerchant || t.merchantName))}
                          onReuse={() => setPrefill({
                            merchantName: t.normalizedMerchant || t.merchantName,
                            amountArs: t.amountArs,
                            amountUsd: t.amountUsd,
                            categoryId: t.categoryId,
                            transactionType: t.transactionType,
                            isInstallment: t.isInstallment,
                            installmentCurrent: t.installmentCurrent,
                            installmentTotal: t.installmentTotal,
                          })}
                          onEdit={canManage ? () => setEditingTx(t) : undefined}
                          onDelete={canManage ? () => handleDelete(t.id) : undefined}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-zinc-50"
          >
            Anterior
          </button>
          <span className="text-zinc-500">Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-zinc-50"
          >
            Siguiente
          </button>
        </div>
      )}

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={fetchTransactions}
        />
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-sm text-zinc-400">Cargando...</div>}>
      <TransactionsInner />
    </Suspense>
  );
}
