"use client";

import { useEffect, useRef, useState, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

interface FileStatus {
  file: File;
  status: "pending" | "uploading" | "processing" | "done" | "error" | "duplicate";
  message?: string;
  statementId?: string;
  jobId?: string;
}

async function readJsonSafely(res: Response) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("La respuesta del servidor no fue JSON válido");
  }
}

export default function StatementUploadPanel({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const processingItems = files.filter((file) => file.status === "processing" && file.jobId);
    if (!processingItems.length) return;

    const intervalId = window.setInterval(async () => {
      for (const item of processingItems) {
        try {
          const res = await fetch(`/api/import-jobs/${item.jobId}`);
          const json = await readJsonSafely(res);

          if (!res.ok) {
            throw new Error(typeof json.error === "string" ? json.error : "No se pudo consultar el estado del análisis");
          }

          if (json.status === "QUEUED" || json.status === "ANALYZING") {
            continue;
          }

          if (json.status === "FAILED") {
            const errorMessage = typeof json.errorMessage === "string" ? json.errorMessage : "Falló el análisis AI";
            setFiles((prev) =>
              prev.map((f) =>
                f.file === item.file
                  ? { ...f, status: "error", message: errorMessage }
                  : f
              )
            );
            continue;
          }

          const bankName = typeof json.bankName === "string" ? json.bankName : "Banco detectado";
          const processingStatus = typeof json.status === "string" ? json.status : "";
          const aiMessage = ["REVIEW_REQUIRED", "PRELIMINARY"].includes(processingStatus)
            ? `${bankName} · AI · revisión sugerida`
            : `${bankName} · AI · consistencia validada`;

          showToast({
            tone: "success",
            title: "Resumen importado",
            description: aiMessage,
          });

          setFiles((prev) =>
            prev.map((f) =>
              f.file === item.file
                ? {
                    ...f,
                    status: "done",
                    statementId: typeof json.statementId === "string" ? json.statementId : undefined,
                    message: aiMessage,
                  }
                : f
            )
          );
        } catch (error) {
          setFiles((prev) =>
            prev.map((f) =>
              f.file === item.file
                ? {
                    ...f,
                    status: "error",
                    message: error instanceof Error ? error.message : "Error consultando el análisis AI",
                  }
                : f
            )
          );
        }
      }
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [files, showToast]);

  function addFiles(newFiles: File[]) {
    const pdfs = newFiles.filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    setFiles((prev) => [
      ...prev,
      ...pdfs.map((f) => ({ file: f, status: "pending" as const })),
    ]);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  async function uploadAll() {
    setUploading(true);
    const pending = files.filter((f) => f.status === "pending");
    let shouldClose = pending.length > 0;

    for (const item of pending) {
      setFiles((prev) =>
        prev.map((f) => (f.file === item.file ? { ...f, status: "uploading", message: "Analizando y procesando el PDF..." } : f))
      );

      const formData = new FormData();
      formData.append("file", item.file);

      try {
        const res = await fetch("/api/statements/upload", { method: "POST", body: formData });
        const json = await readJsonSafely(res);
        const bankName = typeof json.bank === "string" ? json.bank : "Banco";
        const transactionCount = typeof json.transactionCount === "number" ? json.transactionCount : Number(json.transactionCount ?? 0);

        if (res.status === 201) {
          showToast({
            tone: "success",
            title: "Resumen importado",
            description: `${bankName} · ${transactionCount} movimientos`,
          });
          setFiles((prev) =>
            prev.map((f) =>
              f.file === item.file
                ? {
                    ...f,
                    status: "done",
                    message: json.importMethod === "AI"
                      ? `${bankName} · ${transactionCount} movimientos · AI ${["REVIEW_REQUIRED", "PRELIMINARY"].includes(String(json.processingStatus ?? "")) ? "· revisión sugerida" : "· consistencia validada"}`
                      : `${bankName} · ${transactionCount} movimientos`,
                    statementId: typeof json.statementId === "string" ? json.statementId : undefined,
                  }
                : f
            )
          );
        } else if (res.status === 202) {
          shouldClose = false;
          showToast({
            tone: "info",
            title: "Importación iniciada",
            description: typeof json.message === "string" ? json.message : "El resumen quedó en cola para análisis AI.",
          });
          setFiles((prev) =>
            prev.map((f) =>
              f.file === item.file
                ? {
                    ...f,
                    status: "processing",
                    message: typeof json.message === "string" ? json.message : "Resumen enviado a análisis AI",
                    jobId: typeof json.jobId === "string" ? json.jobId : undefined,
                  }
                : f
            )
          );
        } else if (res.status === 409) {
          const duplicateMessage = json.jobId && !json.statementId
            ? "Este PDF ya está siendo analizado por AI para tu usuario."
            : "Este resumen ya fue importado para tu usuario.";
          showToast({
            tone: "info",
            title: "Resumen duplicado",
            description: duplicateMessage,
          });
          setFiles((prev) =>
            prev.map((f) =>
              f.file === item.file
                ? {
                    ...f,
                    status: json.jobId && !json.statementId ? "processing" : "duplicate",
                    message: duplicateMessage,
                    statementId: typeof json.existingStatementId === "string" ? json.existingStatementId : typeof json.statementId === "string" ? json.statementId : undefined,
                    jobId: typeof json.jobId === "string" ? json.jobId : undefined,
                  }
                : f
            )
          );
        } else {
          shouldClose = false;
          throw new Error(typeof json.error === "string" ? json.error : "Error desconocido");
        }
      } catch (err) {
        shouldClose = false;
        const msg = err instanceof Error ? err.message : "Error al importar";
        setFiles((prev) =>
          prev.map((f) =>
            f.file === item.file ? { ...f, status: "error", message: msg } : f
          )
        );
      }
    }

    setUploading(false);
    router.refresh();
    if (shouldClose) {
      onComplete?.();
    }
  }

  const hasPending = files.some((f) => f.status === "pending");
  const allDone = files.length > 0 && files.every((f) => f.status === "done" || f.status === "duplicate");

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-14 transition-colors",
          dragging ? "border-indigo-400 bg-indigo-50" : "border-zinc-300 bg-white hover:border-indigo-300 hover:bg-zinc-50"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
          <Upload className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-700">Arrastrá o hacé clic para seleccionar</p>
          <p className="mt-0.5 text-xs text-zinc-400">PDFs · BBVA y Galicia nativos · otros bancos con fallback AI si la integración está configurada</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {files.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {files.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 flex-shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-700">{item.file.name}</p>
                  {item.message && (
                    <p className={cn("text-xs", item.status === "error" ? "text-red-500" : "text-zinc-400")}>
                      {item.message}
                    </p>
                  )}
                </div>
                <StatusIcon status={item.status} />
                {(item.status === "done" || item.status === "duplicate") && item.statementId && (
                  <button
                    onClick={() => router.push(`/statements/${item.statementId}`)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Ver
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        {hasPending && !uploading && (
          <Button onClick={uploadAll} className="flex-1">
            Importar {files.filter((f) => f.status === "pending").length} archivo{files.filter((f) => f.status === "pending").length !== 1 ? "s" : ""}
          </Button>
        )}
        {uploading && (
          <Button disabled className="flex-1">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Importando...
          </Button>
        )}
        {allDone && (
          <Button onClick={() => router.push("/dashboard")} variant="outline" className="flex-1">
            Ver dashboard
          </Button>
        )}
        {files.length > 0 && !uploading && (
          <Button variant="ghost" onClick={() => setFiles([])}>
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: FileStatus["status"] }) {
  if (status === "uploading") return <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />;
  if (status === "processing") return <Loader2 className="h-4 w-4 animate-spin text-violet-500" />;
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "duplicate") return <CheckCircle2 className="h-4 w-4 text-amber-400" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return <div className="h-4 w-4 rounded-full border-2 border-zinc-300" />;
}
