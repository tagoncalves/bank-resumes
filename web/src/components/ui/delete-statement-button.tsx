"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
