"use client";

import { useState, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileStatus {
  file: File;
  status: "pending" | "uploading" | "done" | "error" | "duplicate";
  message?: string;
  statementId?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

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

    for (const item of pending) {
      setFiles((prev) =>
        prev.map((f) => (f.file === item.file ? { ...f, status: "uploading" } : f))
      );

      const formData = new FormData();
      formData.append("file", item.file);

      try {
        const res = await fetch("/api/statements/upload", { method: "POST", body: formData });
        const json = await res.json();

        if (res.status === 201) {
          setFiles((prev) =>
            prev.map((f) =>
              f.file === item.file
                ? { ...f, status: "done", message: `${json.bank} · ${json.transactionCount} movimientos`, statementId: json.statementId }
                : f
            )
          );
        } else if (res.status === 409) {
          setFiles((prev) =>
            prev.map((f) =>
              f.file === item.file
                ? { ...f, status: "duplicate", message: "Ya fue importado", statementId: json.existingStatementId }
                : f
            )
          );
        } else {
          throw new Error(json.error ?? "Error desconocido");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al importar";
        setFiles((prev) =>
          prev.map((f) =>
            f.file === item.file ? { ...f, status: "error", message: msg } : f
          )
        );
      }
    }

    setUploading(false);
  }

  const hasPending = files.some((f) => f.status === "pending");
  const allDone = files.length > 0 && files.every((f) => f.status === "done" || f.status === "duplicate");

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Drop zone */}
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
          <p className="text-xs text-zinc-400 mt-0.5">Solo archivos PDF · BBVA y Galicia</p>
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

      {/* File list */}
      {files.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {files.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 flex-shrink-0 text-zinc-400" />
                <div className="flex-1 min-w-0">
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

      {/* Actions */}
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
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "duplicate") return <CheckCircle2 className="h-4 w-4 text-amber-400" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return <div className="h-4 w-4 rounded-full border-2 border-zinc-300" />;
}
