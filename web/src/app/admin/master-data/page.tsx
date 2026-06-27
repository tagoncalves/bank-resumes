"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Database } from "lucide-react";

type MasterEntitySummary = {
  key: string;
  label: string;
  singularLabel: string;
  description: string;
  count: number;
};

export default function MasterDataPage() {
  const [entities, setEntities] = useState<MasterEntitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/master-data")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "No se pudieron cargar los datos maestros");
        setEntities(json.entities ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error inesperado"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Datos maestros</h1>
            <p className="text-sm text-zinc-500">Administración centralizada de entidades base del sistema.</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Cargando entidades...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {entities.map((entity) => (
            <Link
              key={entity.key}
              href={`/admin/master-data/${entity.key}`}
              className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{entity.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{entity.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-semibold tabular-nums text-zinc-900">{entity.count}</p>
                  <p className="text-xs text-zinc-400">registros</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500 group-hover:bg-indigo-50 group-hover:text-indigo-700">
                  Editar
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
