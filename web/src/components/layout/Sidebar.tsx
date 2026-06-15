"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, List, CreditCard, Users, LogOut, ShieldAlert, FileBadge2, Bot, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Movimientos", icon: List },
  { href: "/statements", label: "Resúmenes", icon: FileText },
  { href: "/payslips", label: "Recibos", icon: FileBadge2 },
  { href: "/ai", label: "AI Chat", icon: Bot },
];

interface Me { username: string; role: string; displayName: string | null }

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setMe).catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-zinc-200 px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
          <CreditCard className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Nerun Finance</p>
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
        {/* Admin-only */}
        {me?.role === "ADMIN" && (
          <>
            <div className="my-2 border-t border-zinc-100" />
            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/admin/users")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Users className={cn("h-4 w-4", pathname.startsWith("/admin/users") ? "text-indigo-600" : "text-zinc-400")} />
              Usuarios
            </Link>
            <Link
              href="/admin/review-statements"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/admin/review-statements")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <ShieldAlert className={cn("h-4 w-4", pathname.startsWith("/admin/review-statements") ? "text-indigo-600" : "text-zinc-400")} />
              Revisión AI
            </Link>
            <Link
              href="/admin/ai-bans"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/admin/ai-bans")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Ban className={cn("h-4 w-4", pathname.startsWith("/admin/ai-bans") ? "text-indigo-600" : "text-zinc-400")} />
              Baneos AI
            </Link>
          </>
        )}
      </nav>

      {/* Footer: user + logout */}
      <div className="border-t border-zinc-200 px-4 py-3">
        {me && (
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-700">{me.displayName ?? me.username}</p>
              <p className="text-[10px] text-zinc-400">{me.role === "ADMIN" ? "Administrador" : "Usuario"}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="text-[11px] text-zinc-400">BBVA · Galicia</p>
      </div>
    </aside>
  );
}
