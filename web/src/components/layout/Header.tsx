"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/statements": "Resúmenes",
  "/transactions": "Movimientos",
  "/upload": "Importar resumen",
};

export default function Header() {
  const pathname = usePathname();

  const title =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ??
    "BankResume";

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
      <Link href="/upload">
        <Button size="sm">
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Importar
        </Button>
      </Link>
    </header>
  );
}
