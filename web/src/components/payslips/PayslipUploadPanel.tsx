"use client";

import { DragEvent, useRef, useState } from "react";
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
  payslipId?: string;
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

export default function PayslipUploadPanel({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  function addFiles(newFiles: File[]) {
    const pdfs = newFiles.filter((file) => file.type === "application/pdf" || file.name.endsWith(".pdf"));
    setFiles((prev) => [
      ...prev,
      ...pdfs.map((file) => ({ file, status: "pending" as const })),
    ]);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  async function uploadAll() {
    setUploading(true);
    const pending = files.filter((file) => file.status === "pending");
    let shouldClose = pending.length > 0;

    for (const item of pending) {
      setFiles((prev) =>
        prev.map((file) =>
          file.file === item.file
            ? { ...file, status: "uploading", message: "Analizando el recibo y generando el ingreso..." }
            : file
        )
      );

      const formData = new FormData();
      formData.append("file", item.file);

      try {
        const res = await fetch("/api/payslips/upload", { method: "POST", body: formData });
        const json = await readJsonSafely(res);
        const amountArs = typeof json.amountArs === "number" ? json.amountArs : Number(json.amountArs ?? 0);
        const employerName = typeof json.employerName === "string" ? json.employerName : "Recibo";

        if (res.status === 201) {
          showToast({
            tone: "success",
            title: "Recibo cargado",
            description: `${employerName} · ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amountArs)}`,
          });
          setFiles((prev) =>
            prev.map((file) =>
              file.file === item.file
                ? {
                    ...file,
                    status: "done",
                    message: `${employerName} · ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amountArs)} · ${json.importMethod === "AI" ? `AI${json.processingStatus === "REVIEW_REQUIRED" ? " · revisar" : ""}` : "mapeo automático"}`,
                    payslipId: typeof json.payslipId === "string" ? json.payslipId : undefined,
                  }
                : file
            )
          );
        } else if (res.status === 202) {
          showToast({
            tone: "info",
            title: "Análisis AI iniciado",
            description: typeof json.message === "string" ? json.message : "El recibo quedó en cola para análisis AI.",
          });
          setFiles((prev) =>
            prev.map((file) =>
              file.file === item.file
                ? {
                    ...file,
                    status: "processing",
                    message: typeof json.message === "string" ? json.message : "Recibo enviado a análisis AI en segundo plano",
                    payslipId: typeof json.payslipId === "string" ? json.payslipId : undefined,
                  }
                : file
            )
          );
        } else if (res.status === 409) {
          setFiles((prev) =>
            prev.map((file) =>
              file.file === item.file
                ? {
                    ...file,
                    status: "duplicate",
                    message: "Este recibo ya fue cargado",
                    payslipId: typeof json.existingPayslipId === "string" ? json.existingPayslipId : undefined,
                  }
                : file
            )
          );
        } else {
          shouldClose = false;
          throw new Error(typeof json.error === "string" ? json.error : "Error desconocido");
        }
      } catch (error) {
        shouldClose = false;
        setFiles((prev) =>
          prev.map((file) =>
            file.file === item.file
              ? {
                  ...file,
                  status: "error",
                  message: error instanceof Error ? error.message : "Error al cargar",
                }
              : file
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

  const hasPending = files.some((file) => file.status === "pending");
  const allDone = files.length > 0 && files.every((file) => file.status === "done" || file.status === "duplicate");

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
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
          <p className="mt-0.5 text-xs text-zinc-400">PDFs de recibos de sueldo</p>
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
            {files.map((item, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3">
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
                {(item.status === "done" || item.status === "duplicate") && item.payslipId && (
                  <a
                    href={`/api/payslips/${item.payslipId}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    Ver
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        {hasPending && !uploading && (
          <Button onClick={uploadAll} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            Cargar {files.filter((file) => file.status === "pending").length} archivo{files.filter((file) => file.status === "pending").length !== 1 ? "s" : ""}
          </Button>
        )}
        {uploading && (
          <Button disabled className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando...
          </Button>
        )}
        {allDone && (
          <Button onClick={() => router.push("/payslips")} variant="outline" className="flex-1">
            Ver recibos
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
  if (status === "uploading") return <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />;
  if (status === "processing") return <Loader2 className="h-4 w-4 animate-spin text-violet-500" />;
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "duplicate") return <CheckCircle2 className="h-4 w-4 text-amber-400" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return <div className="h-4 w-4 rounded-full border-2 border-zinc-300" />;
}
