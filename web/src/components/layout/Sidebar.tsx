"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, List, Users, LogOut, ShieldAlert, FileBadge2, Bot, Ban, Bell, Database, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { NerumMark } from "@/components/brand/nerum-mark";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Movimientos", icon: List },
  { href: "/statements", label: "Resúmenes", icon: FileText },
  { href: "/payslips", label: "Recibos", icon: FileBadge2 },
  { href: "/projections", label: "Proyección", icon: BarChart3 },
  { href: "/ai", label: "AI Chat", icon: Bot },
];

interface Me { username: string; role: string; displayName: string | null }

function SidebarLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary/30 bg-[var(--color-selected)] text-primary shadow-sm"
          : "border-transparent text-muted hover:border-border hover:bg-[var(--color-hover)] hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted")} />
      {label}
    </Link>
  );
}

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
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <NerumMark className="h-8 w-8 shrink-0 shadow-sm" />
        <div>
          <p className="text-sm font-semibold text-foreground">Nerum Finance</p>
          <p className="text-[10px] leading-none text-muted">Gestor financiero</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <SidebarLink key={item.href} href={item.href} label={item.label} icon={Icon} active={active} />
          );
        })}
        {/* Admin-only */}
        {me?.role === "ADMIN" && (
          <>
            <div className="my-2 border-t border-border" />
            <SidebarLink href="/admin/master-data" label="Datos maestros" icon={Database} active={pathname.startsWith("/admin/master-data")} />
            <SidebarLink href="/admin/users" label="Usuarios" icon={Users} active={pathname.startsWith("/admin/users")} />
            <SidebarLink href="/admin/review-statements" label="Revisión AI" icon={ShieldAlert} active={pathname.startsWith("/admin/review-statements")} />
            <SidebarLink href="/admin/ai-bans" label="Baneos AI" icon={Ban} active={pathname.startsWith("/admin/ai-bans")} />
            <SidebarLink href="/admin/notifications" label="Notificaciones" icon={Bell} active={pathname.startsWith("/admin/notifications")} />
          </>
        )}
      </nav>

      {/* Footer: user + logout */}
      <div className="border-t border-border px-4 py-3">
        {me && (
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">{me.displayName ?? me.username}</p>
              <p className="text-[10px] text-muted">{me.role === "ADMIN" ? "Administrador" : "Usuario"}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="rounded border border-transparent p-1 text-muted hover:border-border hover:bg-[var(--color-hover)] hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="text-[11px] text-muted">BBVA · Galicia</p>
      </div>
    </aside>
  );
}
