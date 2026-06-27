"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Brain, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input";

interface ImportItem {
  file: File;
  employerName: string;
  periodLabel: string;
  payDate: string;
  netAmount: string;
  currency: "ARS" | "USD" | "EUR";
  analyzeWithAi: boolean;
  status: "pending" | "uploading" | "completed" | "queued" | "error" | "duplicate";
  message?: string;
  payslipId?: string;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

async function readJsonSafely(res: Response) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("La respuesta del servidor no fue JSON válido");
  }
}

export default function PayslipUploadPanel({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [employers, setEmployers] = useState<string[]>([]);
  const [openEmployer, setOpenEmployer] = useState<number | null>(null);
  const [employerSearch, setEmployerSearch] = useState("");

  useEffect(() => {
    fetch("/api/payslips/employers")
      .then((r) => r.json())
      .then((data) => setEmployers(data.employers ?? []))
      .catch(() => {});
  }, []);

  function addFiles(newFiles: File[]) {
    const supported = newFiles.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.endsWith(".pdf") ||
        file.type.startsWith("image/") ||
        file.name.match(/\.(png|jpg|jpeg|webp)$/i)
    );

    const now = new Date();
    const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");
    const defaultYear = now.getFullYear();

    const newItems: ImportItem[] = supported.map((file) => ({
      file,
      employerName: "",
      periodLabel: `${defaultMonth}/${defaultYear}`,
      payDate: now.toISOString().split("T")[0],
      netAmount: "",
      currency: "ARS",
      analyzeWithAi: false,
      status: "pending" as const,
    }));

    setItems((prev) => [...prev, ...newItems]);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  function updateItem(index: number, updates: Partial<ImportItem>) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function selectEmployer(index: number, name: string) {
    updateItem(index, { employerName: name });
    setOpenEmployer(null);
    setEmployerSearch("");
  }

  function toggleEmployerDropdown(index: number) {
    setOpenEmployer((prev) => (prev === index ? null : index));
    setEmployerSearch("");
  }

  function handleNetAmountChange(index: number, raw: string) {
    const parsed = parseMoneyInput(raw);
    if (parsed === "") {
      updateItem(index, { netAmount: "" });
      return;
    }
    const num = Number(parsed);
    if (isNaN(num)) return;
    updateItem(index, { netAmount: parsed });
  }

  async function importAll() {
    const pending = items.filter((item) => item.status === "pending");

    for (const item of pending) {
      if (!item.analyzeWithAi) {
        if (!item.employerName.trim() || !item.periodLabel.trim() || !item.payDate || !item.netAmount) {
          showToast({ tone: "error", title: "Completá todos los campos o marcá 'Analizar con AI'" });
          return;
        }
        const amount = parseFloat(item.netAmount);
        if (isNaN(amount) || amount <= 0) {
          showToast({ tone: "error", title: "El sueldo neto debe ser un número positivo" });
          return;
        }
      }
    }

    setImporting(true);
    let allSuccess = true;
    let hasManual = false;
    let hasQueued = false;
    let hasDuplicate = false;

    for (const item of pending) {
      const idx = items.indexOf(item);
      updateItem(idx, { status: "uploading", message: "Importando..." });

      const formData = new FormData();
      formData.append("file", item.file);

      if (item.analyzeWithAi) {
        formData.append("mode", "ai");
      } else {
        formData.append("mode", "manual");
        formData.append("employerName", item.employerName.trim());
        formData.append("periodLabel", item.periodLabel.trim());
        formData.append("payDate", item.payDate);
        formData.append("netAmount", item.netAmount);
        formData.append("currency", item.currency);
      }

      try {
        const res = await fetch("/api/payslips/upload", { method: "POST", body: formData });
        const json = await readJsonSafely(res);
        const payslipId = typeof json.payslipId === "string"
          ? json.payslipId
          : typeof json.existingPayslipId === "string"
            ? json.existingPayslipId
            : undefined;

        if (res.status === 409) {
          hasDuplicate = true;
          showToast({
            tone: "info",
            title: "Recibo duplicado",
            description: "Este recibo ya fue cargado para tu usuario.",
          });
          updateItem(idx, { status: "duplicate", message: "Este recibo ya fue cargado para tu usuario", payslipId });
          continue;
        }

        if (res.status === 201) {
          const amountArs = typeof json.amountArs === "number" ? json.amountArs : 0;
          const employerName = typeof json.employerName === "string" ? json.employerName : "";
          const formattedAmount = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amountArs);
          updateItem(idx, {
            status: "completed",
            message: `${employerName} · ${formattedAmount}`,
            payslipId,
          });

          if (!employers.includes(employerName)) {
            setEmployers((prev) => [...prev, employerName].sort());
          }

          hasManual = true;
        } else if (res.status === 202) {
          updateItem(idx, {
            status: "queued",
            message: typeof json.message === "string" ? json.message : "Enviado a AI",
            payslipId,
          });
          hasQueued = true;
        } else {
          throw new Error(typeof json.error === "string" ? json.error : "Error desconocido");
        }
      } catch (error) {
        allSuccess = false;
        updateItem(idx, {
          status: "error",
          message: error instanceof Error ? error.message : "Error al importar",
        });
      }
    }

    setImporting(false);
    router.refresh();

    if (allSuccess && (hasManual || hasQueued)) {
      showToast({
        tone: "success",
        title: "Recibos importados",
        description: hasManual && hasQueued
          ? "Algunos se importaron y otros están en cola AI"
          : hasQueued
            ? "Los recibos están en cola para análisis AI"
            : "Recibos importados correctamente",
      });
    } else if (allSuccess && hasDuplicate) {
      showToast({
        tone: "info",
        title: "Sin cambios",
        description: "Todos los recibos seleccionados ya estaban cargados para tu usuario.",
      });
    }

    if (allSuccess && items.every((i) => i.status === "completed" || i.status === "queued" || i.status === "duplicate")) {
      setTimeout(() => onComplete?.(), 1200);
    }
  }

  const hasPending = items.some((i) => i.status === "pending");
  const allDone = items.length > 0 && items.every((i) => i.status !== "pending" && i.status !== "uploading");

  if (items.length === 0) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-14 transition-colors",
          dragging ? "border-emerald-400 bg-emerald-50" : "border-zinc-300 bg-white hover:border-emerald-300 hover:bg-zinc-50"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <Upload className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-700">Arrastrá o hacé clic para seleccionar</p>
          <p className="mt-0.5 text-xs text-zinc-400">PDFs o imágenes de recibos de sueldo</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,image/png,image/jpeg,image.webp"
        multiple
        className="hidden"
        onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
      />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-700">Completá los datos para importar</p>
          <p className="text-xs text-zinc-400">
            {items.length} archivo{items.length !== 1 ? "s" : ""}
            {!importing && (
              <button onClick={() => inputRef.current?.click()} className="ml-2 text-emerald-600 hover:underline">
                + Agregar más
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const done = item.status === "completed" || item.status === "queued" || item.status === "duplicate";

          return (
            <Card key={index} className={cn(done && "opacity-60")}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0 text-zinc-400" />
                  <p className="truncate text-sm font-medium text-zinc-700">{item.file.name}</p>
                  <StatusIcon status={item.status} />
                  {item.status === "pending" && !importing && (
                    <button onClick={() => removeItem(index)} className="ml-auto text-xs text-zinc-400 hover:text-red-500">
                      Quitar
                    </button>
                  )}
                </div>

                {item.message && (
                  <p className={cn("text-xs", item.status === "error" ? "text-red-500" : item.status === "queued" ? "text-violet-500" : "text-zinc-400")}>
                    {item.message}
                  </p>
                )}

                {item.status === "pending" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`ai-${index}`}
                        checked={item.analyzeWithAi}
                        onChange={(e) => updateItem(index, { analyzeWithAi: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                      />
                      <label htmlFor={`ai-${index}`} className="flex items-center gap-1.5 text-sm text-zinc-600 cursor-pointer select-none">
                        <Brain className="h-4 w-4 text-violet-500" />
                        Analizar con AI
                      </label>
                    </div>

                    {!item.analyzeWithAi && (
                      <div className="grid grid-cols-2 gap-3">
                        {/* Employer selector */}
                        <div className="relative">
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Empleador</label>
                          <button
                            type="button"
                            onClick={() => toggleEmployerDropdown(index)}
                            className="flex w-full items-center justify-between rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          >
                            <span className={item.employerName ? "text-zinc-800" : "text-zinc-400"}>
                              {item.employerName || "Seleccioná un empleador"}
                            </span>
                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                          </button>
                          {openEmployer === index && (
                            <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg">
                              <input
                                ref={searchRef}
                                type="text"
                                value={employerSearch}
                                onChange={(e) => setEmployerSearch(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full border-b border-zinc-200 px-3 py-2 text-sm outline-none"
                                autoFocus
                              />
                              <div className="max-h-44 overflow-y-auto">
                                {employers
                                  .filter((e) => e.toLowerCase().includes(employerSearch.toLowerCase()))
                                  .map((e) => (
                                    <button
                                      key={e}
                                      type="button"
                                      onClick={() => selectEmployer(index, e)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 hover:text-emerald-700"
                                    >
                                      {e}
                                    </button>
                                  ))}
                                {employerSearch && !employers.some((e) => e.toLowerCase() === employerSearch.toLowerCase()) && (
                                  <button
                                    type="button"
                                    onClick={() => selectEmployer(index, employerSearch)}
                                    className="w-full px-3 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50"
                                  >
                                    Usar &quot;{employerSearch}&quot;
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Period (month/year) */}
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Período</label>
                          <div className="flex gap-2">
                            <select
                              value={item.periodLabel ? item.periodLabel.split("/")[0] || "01" : "01"}
                              onChange={(e) => {
                                const parts = item.periodLabel.split("/");
                                updateItem(index, { periodLabel: `${e.target.value}/${parts[1] || new Date().getFullYear()}` });
                              }}
                              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            >
                              {MONTHS.map((m, i) => (
                                <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
                              ))}
                            </select>
                            <select
                              value={item.periodLabel ? item.periodLabel.split("/")[1] || String(new Date().getFullYear()) : String(new Date().getFullYear())}
                              onChange={(e) => {
                                const parts = item.periodLabel.split("/");
                                updateItem(index, { periodLabel: `${parts[0] || "01"}/${e.target.value}` });
                              }}
                              className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            >
                              {Array.from({ length: 15 }, (_, i) => {
                                const y = new Date().getFullYear() - 2 + i;
                                return <option key={y} value={y}>{y}</option>;
                              })}
                            </select>
                          </div>
                        </div>

                        {/* Pay date */}
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha de cobro</label>
                          <input
                            type="date"
                            value={item.payDate}
                            onChange={(e) => updateItem(index, { payDate: e.target.value })}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Amount with currency */}
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Sueldo neto</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatMoneyInput(item.netAmount)}
                                onChange={(e) => handleNetAmountChange(index, e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-zinc-300 py-2 pl-7 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 tabular-nums"
                              />
                            </div>
                            <select
                              value={item.currency}
                              onChange={(e) => updateItem(index, { currency: e.target.value as ImportItem["currency"] })}
                              className="w-20 rounded-lg border border-zinc-300 px-2 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="ARS">ARS</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3">
        {hasPending && !importing && (
          <Button onClick={importAll} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            Importar {items.filter((i) => i.status === "pending").length} archivo{items.filter((i) => i.status === "pending").length !== 1 ? "s" : ""}
          </Button>
        )}
        {importing && (
          <Button disabled className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Importando...
          </Button>
        )}
        {allDone && (
          <>
            <Button onClick={() => { onComplete?.(); router.push("/payslips"); }} variant="outline" className="flex-1">
              Ver recibos
            </Button>
            <Button variant="ghost" onClick={() => setItems([])}>
              Cargar más
            </Button>
          </>
        )}
        {!hasPending && !importing && !allDone && (
          <Button variant="ghost" onClick={() => setItems([])}>
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ImportItem["status"] }) {
  if (status === "uploading") return <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />;
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "queued") return <Brain className="h-4 w-4 text-violet-500" />;
  if (status === "duplicate") return <CheckCircle2 className="h-4 w-4 text-amber-400" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return null;
}
