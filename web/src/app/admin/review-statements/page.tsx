"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatARS, formatDate } from "@/lib/formatters";
import { Check, Eye, RefreshCcw, ShieldAlert, X } from "lucide-react";

interface ReviewStatementRow {
  id: string;
  bankName: string;
  holderName: string;
  cardLastFour: string;
  cardNetwork: string;
  periodEnd: string;
  dueDate: string;
  uploadedAt: string;
  processingStatus: "REVIEW_REQUIRED" | "REJECTED" | "COMPLETED";
  analysisProvider?: string | null;
  analysisModel?: string | null;
  analysisPromptVersion?: string | null;
  analysisConfidence?: number | null;
  analysisNotes?: string | null;
  analysisStructuredJson?: string | null;
  sourceTextExcerpt?: string | null;
  aiRequestPayload?: string | null;
  aiRawResponse?: string | null;
  latestJobId?: string | null;
  latestJobStatus?: string | null;
  latestJobAttempts: number;
  latestJobLastProcessedAt?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  transactionCount: number;
  currentBalance: number;
}

export default function ReviewStatementsPage() {
  const [items, setItems] = useState<ReviewStatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/review-statements");
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "No se pudieron cargar los resúmenes para revisión");
      setLoading(false);
      return;
    }

    setItems(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const pendingItems = useMemo(
    () => items.filter((item) => item.processingStatus === "REVIEW_REQUIRED"),
    [items]
  );

  async function applyDecision(id: string, action: "approve" | "reject" | "reprocess") {
    setSavingId(id);
    setError(null);

    const res = await fetch(`/api/admin/review-statements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNotes: notes[id] ?? "" }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "No se pudo guardar la revisión");
      setSavingId(null);
      return;
    }

    if (action === "reprocess") {
      await load();
      setSavingId(null);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              processingStatus: json.processingStatus,
              reviewNotes: json.reviewNotes,
              reviewedAt: json.reviewedAt,
              reviewedBy: json.reviewedBy,
            }
          : item
      )
    );
    setSavingId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Revisión manual AI</h1>
          <p className="text-sm text-zinc-500">Resúmenes con desvíos detectados por consistencia o decisión manual previa</p>
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {pendingItems.length} pendiente{pendingItems.length === 1 ? "" : "s"}
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-3 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-zinc-400">Cargando...</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-600">No hay resúmenes AI para revisar</p>
            <p className="text-xs text-zinc-400">Cuando un resumen quede con `REVIEW_REQUIRED`, aparecerá en esta bandeja.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const pending = item.processingStatus === "REVIEW_REQUIRED";
            const rejected = item.processingStatus === "REJECTED";

            return (
              <Card key={item.id} className={pending ? "border-amber-200" : rejected ? "border-red-200" : "border-emerald-200"}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-sm font-medium text-zinc-800">
                        {item.bankName} · {item.cardNetwork} •••• {item.cardLastFour}
                      </CardTitle>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.holderName} · cierre {formatDate(item.periodEnd)} · vto {formatDate(item.dueDate)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pending ? "bg-amber-100 text-amber-700" : rejected ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {pending ? "Revisión requerida" : rejected ? "Rechazado" : "Aprobado"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4 text-sm">
                    <div>
                      <p className="text-xs text-zinc-400">Saldo actual</p>
                      <p className="font-mono text-zinc-800">{formatARS(item.currentBalance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Movimientos</p>
                      <p className="text-zinc-800">{item.transactionCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Proveedor AI</p>
                      <p className="text-zinc-800">{item.analysisProvider ? "AI" : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Confianza</p>
                      <p className="text-zinc-800">{typeof item.analysisConfidence === "number" ? `${(item.analysisConfidence * 100).toFixed(0)}%` : "—"}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4 text-sm">
                    <div>
                      <p className="text-xs text-zinc-400">Modelo</p>
                      <p className="text-zinc-800">{item.analysisModel ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Prompt</p>
                      <p className="text-zinc-800">{item.analysisPromptVersion ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Job</p>
                      <p className="font-mono text-zinc-800">{item.latestJobId ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Intentos</p>
                      <p className="text-zinc-800">{item.latestJobAttempts}</p>
                    </div>
                  </div>

                  {item.analysisNotes && (
                    <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 whitespace-pre-line">
                      <p className="mb-1 font-medium">Notas del análisis</p>
                      {item.analysisNotes}
                    </div>
                  )}

                  {item.analysisStructuredJson && (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                      <button
                        onClick={() => setExpandedEvidenceId((current) => current === item.id ? null : item.id)}
                        className="font-medium text-zinc-700 hover:text-zinc-900"
                      >
                        {expandedEvidenceId === item.id ? "Ocultar evidencia AI" : "Ver evidencia AI estructurada"}
                      </button>
                      {expandedEvidenceId === item.id && (
                        <div className="mt-2 space-y-3">
                          <section>
                            <p className="mb-1 font-medium text-zinc-600">Resultado estructurado</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-[11px] leading-5 text-zinc-700">{item.analysisStructuredJson}</pre>
                          </section>
                          {item.sourceTextExcerpt && (
                            <section>
                              <p className="mb-1 font-medium text-zinc-600">Texto fuente extraído</p>
                              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-[11px] leading-5 text-zinc-700">{item.sourceTextExcerpt}</pre>
                            </section>
                          )}
                          {item.aiRequestPayload && (
                            <section>
                              <p className="mb-1 font-medium text-zinc-600">Request enviado al modelo</p>
                              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-[11px] leading-5 text-zinc-700">{item.aiRequestPayload}</pre>
                            </section>
                          )}
                          {item.aiRawResponse && (
                            <section>
                              <p className="mb-1 font-medium text-zinc-600">Respuesta raw del modelo</p>
                              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-[11px] leading-5 text-zinc-700">{item.aiRawResponse}</pre>
                            </section>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <textarea
                    value={notes[item.id] ?? item.reviewNotes ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Notas del revisor..."
                    className="min-h-24 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-zinc-400">
                      {item.reviewedBy && item.reviewedAt
                        ? `Última revisión: ${item.reviewedBy} · ${new Date(item.reviewedAt).toLocaleString("es-AR")}`
                        : `Subido el ${new Date(item.uploadedAt).toLocaleString("es-AR")}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/statements/${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" /> Ver detalle
                      </Link>
                      <button
                        onClick={() => applyDecision(item.id, "reprocess")}
                        disabled={savingId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                      >
                        <RefreshCcw className="h-4 w-4" /> Reprocesar
                      </button>
                      <button
                        onClick={() => applyDecision(item.id, "approve")}
                        disabled={savingId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" /> Aprobar
                      </button>
                      <button
                        onClick={() => applyDecision(item.id, "reject")}
                        disabled={savingId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" /> Rechazar
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
