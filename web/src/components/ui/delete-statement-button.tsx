"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteStatementButton({
  id,
  redirectTo,
}: {
  id: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar este resumen? Esta acción no se puede deshacer.")) return;
    setLoading(true);
    await fetch(`/api/statements/${id}`, { method: "DELETE" });
    router.push(redirectTo ?? "/statements");
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
      {loading ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
