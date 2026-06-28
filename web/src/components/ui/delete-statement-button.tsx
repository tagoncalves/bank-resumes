"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteStatementButton({
  id,
  redirectTo,
}: {
  id: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    setLoading(true);
    setConfirmOpen(false);
    await fetch(`/api/statements/${id}`, { method: "DELETE" });
    router.push(redirectTo ?? "/statements");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
      >
        <Trash2 className="h-4 w-4" />
        {loading ? "Eliminando..." : "Eliminar"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
        title="Eliminar resumen"
        description="¿Eliminar este resumen? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={loading}
      />
    </>
  );
}
