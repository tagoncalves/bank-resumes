"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatARS, formatUSD, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { AddTransactionForm, type TransactionPrefill } from "@/components/ui/add-transaction-form";
import { TransactionMenu } from "@/components/ui/transaction-menu";
import { EditTransactionModal } from "@/components/ui/edit-transaction-modal";
import { TransactionFilter } from "@/components/transactions/TransactionFilter";

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
  const searchParams = useSearchParams();
  const currentMonth = searchParams.get("month");
  const currentMonths = searchParams.get("months") ? parseInt(searchParams.get("months")!, 10) : 6;
  const categoryIdsStr = searchParams.get("categoryId") ?? "";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [netTotal, setNetTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
      dateTo: now.toISOString().slice(0, 10),
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
    const res = await fetch(`/api/transactions?${params}`);
    const json = await res.json();
    setTransactions(json.data ?? []);
    setTotal(json.total ?? 0);
    setNetTotal(json.netTotal ?? 0);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, sortBy, sortOrder, currentMonth, currentMonths, categoryIdsStr]);

  useEffect(() => {
    const id = setTimeout(fetchTransactions, 300);
    return () => clearTimeout(id);
  }, [fetchTransactions]);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, sortOrder, currentMonth, currentMonths, categoryIdsStr]);

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
  const isNegativeNet = netTotal < 0;

  return (
    <div className="space-y-4">
      {/* Header row: form left, net total right */}
      <div className="flex items-start justify-between gap-4">
        <AddTransactionForm
          onSaved={fetchTransactions}
          prefill={prefill}
          onPrefillConsumed={() => setPrefill(null)}
        />
        <div className="text-right shrink-0">
          <p className="text-xs text-zinc-500">{total} movimientos</p>
          <p className={`text-lg font-semibold font-mono tabular-nums ${isNegativeNet ? "text-emerald-600" : "text-zinc-900"}`}>
            {netTotal < 0 ? "+" : netTotal > 0 ? "-" : ""}{formatARS(Math.abs(netTotal))}
          </p>
          <p className="text-[10px] text-zinc-400">neto del filtro</p>
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
            placeholder="Buscar comercio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch("")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
          >
            Limpiar búsqueda
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
                  const isManual = t.source === "MANUAL";
                  return (
                    <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-zinc-500">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-800">{t.normalizedMerchant || t.merchantName}</span>
                          {t.isInstallment && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                              {t.installmentCurrent}/{t.installmentTotal}
                            </span>
                          )}
                          {isManual && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                              manual
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
                        ) : (
                          <span className="text-zinc-400">Manual</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        {t.category ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: `${t.category.color}20`, color: t.category.color }}
                          >
                            {t.category.name}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
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
                          onFilter={() => setSearch(extractSearchTerm(t.normalizedMerchant || t.merchantName))}
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
                          onEdit={isManual ? () => setEditingTx(t) : undefined}
                          onDelete={isManual ? () => handleDelete(t.id) : undefined}
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
