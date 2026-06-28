"use client";

import { usePathname } from "next/navigation";
import { Upload } from "lucide-react";
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

export default function Header() {
  const pathname = usePathname();
  const { openModal } = useUploadModal();

  const title =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ??
    "Nerum Finance";
  const showImportAction = pathname.startsWith("/statements") || pathname.startsWith("/payslips");
  const actionLabel = pathname.startsWith("/payslips") ? "Cargar recibo" : "Importar";
  const actionKind = pathname.startsWith("/payslips") ? "payslip" : "statement";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        <p className="hidden text-[11px] text-muted sm:block">Finanzas personales, importaciones y revisión</p>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {showImportAction ? (
          <Button size="sm" onClick={() => openModal(actionKind)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
