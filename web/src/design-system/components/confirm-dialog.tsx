"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
}

function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onOpenChange(false);
    }
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, loading, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ds-panel w-full max-w-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted">{description}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Guardando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
