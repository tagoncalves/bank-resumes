"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeletePayslipButton({
  id,
  redirectTo,
}: {
  id: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar este recibo? También se eliminará la transacción asociada. Esta acción no se puede deshacer.")) return;
    setLoading(true);
    await fetch(`/api/payslips/${id}`, { method: "DELETE" });
    router.push(redirectTo ?? "/payslips");
    router.refresh();
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 className="h-4 w-4" />
      {loading ? "Eliminando..." : "Eliminar"}
    </Button>
  );
}
