"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function ClearAnalysisButton({ payslipId, analysisProvider }: { payslipId: string; analysisProvider: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!analysisProvider || analysisProvider === "MANUAL") return null;

  async function handleClear() {
    setLoading(true);
    setConfirmOpen(false);
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
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {loading ? "Eliminando..." : "Eliminar análisis AI"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleClear}
        title="Eliminar análisis AI"
        description="¿Eliminar los resultados del análisis AI? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={loading}
      />
    </>
  );
}
