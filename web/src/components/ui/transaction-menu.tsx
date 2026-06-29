"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pencil, Trash2, Search, Copy, Repeat } from "lucide-react";

const MENU_WIDTH = 176;
const MENU_MARGIN = 8;

export function TransactionMenu({
  onEdit,
  onDelete,
  onFilter,
  onReuse,
  isSubscription,
  onToggleSubscription,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onFilter: () => void;
  onReuse?: () => void;
  isSubscription?: boolean;
  onToggleSubscription?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  function updatePosition() {
    const trigger = ref.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 220;
    const top = rect.bottom + 4 + menuHeight > window.innerHeight - MENU_MARGIN
      ? Math.max(MENU_MARGIN, rect.top - menuHeight - 4)
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(MENU_MARGIN, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - MENU_MARGIN,
    );
    setPosition({ top, left });
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[100] w-44 rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-card"
      style={{ top: position.top, left: position.left }}
    >
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
      {onToggleSubscription && (
        <button
          onClick={() => { setOpen(false); onToggleSubscription(); }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt"
        >
          <Repeat className={`h-3.5 w-3.5 ${isSubscription ? "text-income" : "text-muted"}`} />
          {isSubscription ? "Quitar suscripción" : "Marcar como suscripción"}
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
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-muted hover:bg-surface-alt hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && createPortal(menu, document.body)}
    </div>
  );
}
