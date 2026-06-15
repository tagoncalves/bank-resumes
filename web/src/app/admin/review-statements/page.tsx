"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatARS, formatDate } from "@/lib/formatters";
import { Check, Eye, RefreshCcw, ShieldAlert, X, Code, Download, FileBadge2 } from "lucide-react";

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
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
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

      {/* ─── Pending payslips ──────────────────────────────────────────────── */}
      <PayslipAdminSection />

      {/* ─── AI-generated parsers ──────────────────────────────────────────── */}
      <AiParsersSection />
    </div>
  );
}

function PayslipAdminSection() {
  const [payslips, setPayslips] = useState<Array<{
    id: string;
    rawFilename: string;
    employerName: string | null;
    employeeName: string | null;
    periodLabel: string | null;
    processingStatus: string;
    analysisProvider: string | null;
    analysisNotes: string | null;
    uploadedAt: string;
    user: { username: string; displayName: string | null } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setActionError(null);
    try {
      const r = await fetch("/api/admin/payslips");
      if (!r.ok) { setActionError(`Error al cargar: ${r.status}`); setPayslips([]); return; }
      setPayslips(await r.json());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error de red");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function handleAction(id: string, action: string) {
    setActionId(id);
    setActionError(null);
    try {
      const r = await fetch(`/api/admin/payslips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setActionError(body.error ?? `Error ${r.status}`);
        return;
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error de red");
      return;
    } finally {
      setActionId(null);
    }
    load();
  }

  const pendings = payslips.filter((p) => ["QUEUED", "ANALYZING", "REVIEW_REQUIRED", "FAILED"].includes(p.processingStatus));
  const completed = payslips.filter((p) => p.processingStatus === "COMPLETED");

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center gap-2">
        <FileBadge2 className="h-5 w-5 text-zinc-400" />
        <h2 className="text-base font-semibold text-zinc-800">Recibos de sueldo</h2>
        {pendings.length > 0 && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            {pendings.length} pendiente{pendings.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {actionError && (
        <Card className="border-red-200">
          <CardContent className="py-3 text-sm text-red-600">{actionError}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-400">Cargando recibos...</CardContent>
        </Card>
      ) : pendings.length === 0 && !actionError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <FileBadge2 className="h-6 w-6 text-zinc-300" />
            <p className="text-sm text-zinc-500">No hay recibos pendientes</p>
            <p className="text-xs text-zinc-400">Los recibos en cola, con error, o que requieren revisión aparecerán aquí.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendings.map((p) => {
            const statusLabel =
              p.processingStatus === "QUEUED" ? "En cola"
              : p.processingStatus === "ANALYZING" ? "Analizando"
              : p.processingStatus === "REVIEW_REQUIRED" ? "Revisión requerida"
              : "Error";

            const statusColor =
              p.processingStatus === "QUEUED" ? "bg-blue-100 text-blue-700"
              : p.processingStatus === "ANALYZING" ? "bg-purple-100 text-purple-700"
              : p.processingStatus === "REVIEW_REQUIRED" ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700";

            return (
              <Card key={p.id} className={p.processingStatus === "FAILED" ? "border-red-200" : p.processingStatus === "REVIEW_REQUIRED" ? "border-amber-200" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-sm font-medium text-zinc-800">
                        {p.rawFilename}
                      </CardTitle>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {p.employerName ?? "Sin empleador"} · {p.employeeName ?? "Sin empleado"} · {p.periodLabel ?? "Sin período"}
                        {p.user && ` · ${p.user.displayName ?? p.user.username}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {p.analysisNotes && (
                    <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 whitespace-pre-line">
                      {p.analysisNotes}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/payslips/${p.id}`}
                      className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
                    {p.processingStatus !== "ANALYZING" && (
                      <>
                        <button
                          onClick={() => handleAction(p.id, "retry")}
                          disabled={actionId === p.id}
                          className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" /> Reintentar
                        </button>
                        <button
                          onClick={() => { if (confirm(`¿Eliminar el recibo "${p.rawFilename}"?`)) handleAction(p.id, "delete"); }}
                          disabled={actionId === p.id}
                          className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" /> Eliminar
                        </button>
                      </>
                    )}
                    {p.processingStatus === "ANALYZING" && (
                      <span className="text-xs text-zinc-400 italic">Procesando...</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-600">
            Completados ({completed.length})
          </summary>
          <div className="mt-2 space-y-2">
            {completed.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-zinc-100 bg-zinc-50 px-4 py-2 text-xs">
                <span className="text-zinc-600">{p.rawFilename}</span>
                <span className="text-zinc-400">{p.employerName ?? "—"} · {new Date(p.uploadedAt).toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

type AiParserWithRelations = {
  id: string;
  payslipId: string | null;
  statementId: string | null;
  sourceType: string;
  bankName: string | null;
  employerName: string | null;
  status: string;
  createdAt: string;
  reviewedBy: { username: string; displayName: string | null } | null;
  reviewedAt: string | null;
  payslip: {
    rawFilename: string;
    employerName: string | null;
    employeeName: string | null;
    periodLabel: string | null;
    payDate: string | null;
    netAmount: unknown;
    grossAmount: unknown;
    processingStatus: string;
    analysisProvider: string | null;
    analysisConfidence: number | null;
    analysisNotes: string | null;
    analysisStructuredJson: string | null;
    analysisModel: string | null;
    analysisPromptVersion: string | null;
  } | null;
  statement: {
    rawFilename: string;
    bankName: string | null;
    processingStatus: string;
    analysisProvider: string | null;
    analysisConfidence: number | null;
    analysisNotes: string | null;
    analysisStructuredJson: string | null;
    analysisModel: string | null;
    analysisPromptVersion: string | null;
    card: {
      holderName: string;
      lastFour: string;
      cardNetwork: string;
    } | null;
  } | null;
};

function AiParsersSection() {
  const [parsers, setParsers] = useState<AiParserWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/ai-parsers");
    setParsers(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function applyDecision(id: string, status: "APPROVED" | "REJECTED") {
    setSavingId(id);
    await fetch("/api/admin/ai-parsers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parserId: id, status }),
    });
    setSavingId(null);
    load();
  }

  const pendingParsers = parsers.filter((p) => p.status === "PENDING_REVIEW");
  const reviewedParsers = parsers.filter((p) => p.status !== "PENDING_REVIEW");

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center gap-2">
        <FileBadge2 className="h-5 w-5 text-zinc-400" />
        <h2 className="text-base font-semibold text-zinc-800">Resultados de análisis AI</h2>
        {pendingParsers.length > 0 && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            {pendingParsers.length} pendiente{pendingParsers.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-400">Cargando...</CardContent>
        </Card>
      ) : pendingParsers.length === 0 && reviewedParsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <FileBadge2 className="h-6 w-6 text-zinc-300" />
            <p className="text-sm text-zinc-500">Aún no hay resultados de AI</p>
            <p className="text-xs text-zinc-400">Aparecerán aquí cuando un recibo o resumen sea analizado por AI.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {pendingParsers.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-zinc-500">PENDIENTES DE REVISIÓN</p>
              {pendingParsers.map((p) => (
                <Card key={p.id} className="border-amber-200">
                  <AiResultCard
                    parser={p}
                    savingId={savingId}
                    expandedResult={expandedResult}
                    setExpandedResult={setExpandedResult}
                    applyDecision={applyDecision}
                    showActions
                  />
                </Card>
              ))}
            </div>
          )}
          {reviewedParsers.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-zinc-500">REVISADOS ({reviewedParsers.length})</p>
              {reviewedParsers.map((p) => (
                <Card key={p.id} className={p.status === "APPROVED" ? "border-emerald-200" : "border-red-200"}>
                  <AiResultCard
                    parser={p}
                    savingId={savingId}
                    expandedResult={expandedResult}
                    setExpandedResult={setExpandedResult}
                    applyDecision={applyDecision}
                    showActions={false}
                  />
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AiResultCard({
  parser, savingId, expandedResult, setExpandedResult, applyDecision, showActions,
}: {
  parser: AiParserWithRelations;
  savingId: string | null;
  expandedResult: string | null;
  setExpandedResult: (id: string | null) => void;
  applyDecision: (id: string, status: "APPROVED" | "REJECTED") => void;
  showActions: boolean;
}) {
  const entity = parser.payslip ?? parser.statement;
  const sourceLabel = parser.sourceType === "PAYSLIP" ? "Recibo" : "Resumen";
  const entityName = parser.employerName ?? parser.bankName ?? "Desconocido";
  const detailHref = parser.payslipId ? `/payslips/${parser.payslipId}` : parser.statementId ? `/statements/${parser.statementId}` : null;

  const payslipData = parser.payslip;
  const statementData = parser.statement;

  let structuredData = null;
  try {
    const rawJson = payslipData?.analysisStructuredJson ?? statementData?.analysisStructuredJson;
    if (rawJson) structuredData = JSON.parse(rawJson);
  } catch { /* ignore */ }

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-medium text-zinc-800">
              {sourceLabel} · {entityName}
            </CardTitle>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {entity?.rawFilename ?? "—"} · {new Date(parser.createdAt).toLocaleString("es-AR")}
            </p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            parser.status === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700"
            : parser.status === "APPROVED" ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700"
          }`}>
            {parser.status === "PENDING_REVIEW" ? "Pendiente"
            : parser.status === "APPROVED" ? "Aprobado"
            : "Rechazado"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Extracted data summary */}
        {payslipData && (
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <div>
              <span className="text-zinc-400">Empleador</span>
              <p className="font-medium text-zinc-700">{payslipData.employerName ?? "—"}</p>
            </div>
            <div>
              <span className="text-zinc-400">Empleado</span>
              <p className="font-medium text-zinc-700">{payslipData.employeeName ?? "—"}</p>
            </div>
            <div>
              <span className="text-zinc-400">Período</span>
              <p className="font-medium text-zinc-700">{payslipData.periodLabel ?? "—"}</p>
            </div>
            {payslipData.payDate && (
              <div>
                <span className="text-zinc-400">Fecha de pago</span>
                <p className="font-medium text-zinc-700">{new Date(payslipData.payDate).toLocaleDateString("es-AR")}</p>
              </div>
            )}
            <div>
              <span className="text-zinc-400">Neto</span>
              <p className="font-medium text-zinc-700">{payslipData.netAmount ? formatARS(Number(payslipData.netAmount)) : "—"}</p>
            </div>
            <div>
              <span className="text-zinc-400">Bruto</span>
              <p className="font-medium text-zinc-700">{payslipData.grossAmount ? formatARS(Number(payslipData.grossAmount)) : "—"}</p>
            </div>
          </div>
        )}

        {statementData && (
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <div>
              <span className="text-zinc-400">Banco</span>
              <p className="font-medium text-zinc-700">{statementData.bankName ?? "—"}</p>
            </div>
            <div>
              <span className="text-zinc-400">Titular</span>
              <p className="font-medium text-zinc-700">{statementData.card?.holderName ?? "—"}</p>
            </div>
            <div>
              <span className="text-zinc-400">Tarjeta</span>
              <p className="font-medium text-zinc-700">
                {statementData.card?.cardNetwork ?? ""}{statementData.card?.cardNetwork && statementData.card?.lastFour ? " " : ""}{statementData.card?.lastFour ? `•••• ${statementData.card.lastFour}` : "—"}
              </p>
            </div>
          </div>
        )}

        {(payslipData?.analysisNotes ?? statementData?.analysisNotes) && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 whitespace-pre-line">
            <p className="mb-1 font-medium">Notas del análisis</p>
            {(payslipData?.analysisNotes ?? statementData?.analysisNotes) ?? ""}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <div>
            <span className="text-zinc-400">Confianza</span>
            <p className="font-medium text-zinc-700">{(payslipData ?? statementData)?.analysisConfidence != null ? `${((payslipData ?? statementData)!.analysisConfidence! * 100).toFixed(0)}%` : "—"}</p>
          </div>
          <div>
            <span className="text-zinc-400">Proveedor</span>
            <p className="font-medium text-zinc-700">{(payslipData ?? statementData)?.analysisProvider ?? "—"}</p>
          </div>
          <div>
            <span className="text-zinc-400">Estado</span>
            <p className="font-medium text-zinc-700">REVIEW_REQUIRED</p>
          </div>
        </div>

        {/* Structured result / raw evidence */}
        {(payslipData?.analysisStructuredJson ?? statementData?.analysisStructuredJson) && (
          <div>
            <button
              onClick={() => setExpandedResult(expandedResult === parser.id ? null : parser.id)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              <Code className="h-3.5 w-3.5" />
              {expandedResult === parser.id ? "Ocultar resultado estructurado" : "Ver resultado estructurado del análisis"}
            </button>
            {expandedResult === parser.id && (
              <pre className="mt-2 max-h-96 overflow-x-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-700">{JSON.stringify(structuredData ?? (payslipData?.analysisStructuredJson ?? statementData?.analysisStructuredJson), null, 2)}</pre>
            )}
          </div>
        )}

        {(payslipData?.analysisModel ?? statementData?.analysisModel) && (
          <p className="text-[11px] text-zinc-400">
            Modelo: {payslipData?.analysisModel ?? statementData?.analysisModel}{(payslipData ?? statementData)?.analysisPromptVersion ? ` · Prompt: ${(payslipData ?? statementData)!.analysisPromptVersion}` : ""}
          </p>
        )}

        {parser.reviewedBy && parser.reviewedAt && (
          <p className="text-[11px] text-zinc-400">
            Revisado por {parser.reviewedBy.displayName ?? parser.reviewedBy.username} · {new Date(parser.reviewedAt).toLocaleString("es-AR")}
          </p>
        )}

        <div className="flex items-center gap-2">
          {detailHref && (
            <Link
              href={detailHref}
              className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              <Eye className="h-3.5 w-3.5" /> Ver detalle
            </Link>
          )}
          {showActions && (
            <>
              <button
                onClick={() => applyDecision(parser.id, "APPROVED")}
                disabled={savingId === parser.id}
                className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" /> Aprobar resultado
              </button>
              <button
                onClick={() => applyDecision(parser.id, "REJECTED")}
                disabled={savingId === parser.id}
                className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" /> Rechazar resultado
              </button>
            </>
          )}
        </div>
      </CardContent>
    </>
  );
}
