"use client";

import { usePathname } from "next/navigation";
import { Menu, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadModal } from "@/components/upload/UploadModalProvider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/statements": "Resúmenes",
  "/transactions": "Movimientos",
  "/payslips": "Recibos de sueldo",
  "/admin/master-data": "Datos maestros",
  "/admin/users": "Usuarios",
  "/admin/review-statements": "Revisión AI",
  "/admin/ai-bans": "Baneos AI",
  "/admin/notifications": "Notificaciones",
  "/ai": "AI Chat",
};

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const { openModal } = useUploadModal();

  const title =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ??
    "Nerum Finance";
  const showImportAction = pathname.startsWith("/statements") || pathname.startsWith("/payslips");
  const actionLabel = pathname.startsWith("/payslips") ? "Cargar recibo" : "Importar";
  const actionKind = pathname.startsWith("/payslips") ? "payslip" : "statement";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir navegación"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface-alt text-foreground shadow-sm transition-colors hover:bg-[var(--color-hover)] md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          <p className="hidden text-[11px] text-muted sm:block">Finanzas personales, importaciones y revisión</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        {showImportAction ? (
          <Button size="sm" onClick={() => openModal(actionKind)} className="px-2.5 sm:px-3">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden min-[380px]:inline">{actionLabel}</span>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
