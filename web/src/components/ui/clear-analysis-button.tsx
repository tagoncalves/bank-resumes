"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function ClearAnalysisButton({ payslipId, analysisProvider }: { payslipId: string; analysisProvider: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!analysisProvider || analysisProvider === "MANUAL") return null;

  async function handleClear() {
    if (!confirm("¿Eliminar los resultados del análisis AI? Esta acción no se puede deshacer.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payslips/${payslipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-analysis" }),
      });
      if (!res.ok) throw new Error("Error al limpiar análisis");
      router.refresh();
    } catch {
      alert("Error al limpiar el análisis");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleClear}
      disabled={loading}
      className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {loading ? "Eliminando..." : "Eliminar análisis AI"}
    </button>
  );
}
