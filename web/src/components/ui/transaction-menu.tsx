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
        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-44 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => { setOpen(false); onFilter(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            Ver ocurrencias
          </button>
          {onReuse && (
            <button
              onClick={() => { setOpen(false); onReuse(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <Copy className="h-3.5 w-3.5 text-zinc-400" />
              Reutilizar
            </button>
          )}
          {(onEdit || onDelete) && (
            <div className="my-1 border-t border-zinc-100" />
          )}
          {onEdit && (
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <Pencil className="h-3.5 w-3.5 text-zinc-400" />
              Editar
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
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
