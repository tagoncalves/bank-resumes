"use client";

import { usePathname } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadModal } from "@/components/upload/UploadModalProvider";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/statements": "Resúmenes",
  "/transactions": "Movimientos",
  "/payslips": "Recibos de sueldo",
};

export default function Header() {
  const pathname = usePathname();
  const { openModal } = useUploadModal();

  const title =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ??
    "BankResume";
  const showImportAction = pathname.startsWith("/statements") || pathname.startsWith("/payslips");
  const actionLabel = pathname.startsWith("/payslips") ? "Cargar recibo" : "Importar";
  const actionKind = pathname.startsWith("/payslips") ? "payslip" : "statement";

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
      {showImportAction ? (
        <Button size="sm" onClick={() => openModal(actionKind)}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      ) : <div />}
    </header>
  );
}
