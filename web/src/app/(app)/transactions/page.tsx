"use client";

import { useState, useEffect, useCallback } from "react";
import { formatARS, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  merchantName: string;
  normalizedMerchant: string;
  amountArs: number;
  amountUsd?: number;
  installmentCurrent?: number;
  installmentTotal?: number;
  cardLastFour?: string;
  isInstallment: boolean;
  category?: { name: string; color: string };
  statement: { bankName: string; periodEnd: string };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/transactions?${params}`);
    const json = await res.json();
    setTransactions(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    const id = setTimeout(fetchTransactions, 300);
    return () => clearTimeout(id);
  }, [fetchTransactions]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar comercio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      <p className="text-xs text-zinc-500">{total} movimientos{search ? ` para "${search}"` : ""}</p>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
              Cargando...
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
              Sin resultados
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
                  <th className="px-5 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-5 py-2.5 text-left font-medium">Comercio</th>
                  <th className="px-5 py-2.5 text-left font-medium">Banco</th>
                  <th className="px-5 py-2.5 text-left font-medium">Categoría</th>
                  <th className="px-5 py-2.5 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
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
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-zinc-500">
                      {t.statement.bankName}
                      {t.cardLastFour && <span className="ml-1 text-zinc-400">·•••{t.cardLastFour}</span>}
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
                    <td className="px-5 py-2.5 text-right font-mono font-medium tabular-nums text-zinc-800">
                      {formatARS(t.amountArs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-zinc-50"
          >
            Anterior
          </button>
          <span className="text-zinc-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-zinc-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
