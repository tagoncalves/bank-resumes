"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, Search, Copy } from "lucide-react";

export function TransactionMenu({
  onEdit,
  onDelete,
  onFilter,
  onReuse,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onFilter: () => void;
  onReuse?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-muted hover:bg-surface-alt hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-44 rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-card">
          <button
            onClick={() => { setOpen(false); onFilter(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt"
          >
            <Search className="h-3.5 w-3.5 text-muted" />
            Ver ocurrencias
          </button>
          {onReuse && (
            <button
              onClick={() => { setOpen(false); onReuse(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt"
            >
              <Copy className="h-3.5 w-3.5 text-muted" />
              Reutilizar
            </button>
          )}
          {(onEdit || onDelete) && (
            <div className="my-1 border-t border-border" />
          )}
          {onEdit && (
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt"
            >
              <Pencil className="h-3.5 w-3.5 text-muted" />
              Editar
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-expense hover:bg-expense/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
