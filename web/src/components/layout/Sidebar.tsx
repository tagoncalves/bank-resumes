"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, List, Upload, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/statements", label: "Resúmenes", icon: FileText },
  { href: "/transactions", label: "Movimientos", icon: List },
  { href: "/upload", label: "Importar", icon: Upload },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-zinc-200 px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
          <CreditCard className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">BankResume</p>
          <p className="text-[10px] text-zinc-400 leading-none">Gestor financiero</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-indigo-600" : "text-zinc-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-200 px-4 py-3">
        <p className="text-[11px] text-zinc-400">BBVA · Galicia</p>
        <p className="text-[11px] text-zinc-400">Resúmenes Argentina</p>
      </div>
    </aside>
  );
}
