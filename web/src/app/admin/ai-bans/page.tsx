"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldOff, ShieldCheck, Clock, Ban, Infinity } from "lucide-react";

interface AiBanRow {
  id: string;
  userId: string;
  level: number;
  status: string;
  reason: string | null;
  bannedAt: string;
  expiresAt: string | null;
  pardonedAt: string | null;
  user: { id: string; username: string; displayName: string | null };
  pardonedBy: { id: string; username: string } | null;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "5 min",
  2: "1 h",
  3: "Hasta medianoche",
  4: "Permanente",
};

const LEVEL_ICONS: Record<number, typeof Clock> = {
  1: Clock,
  2: Clock,
  3: Clock,
  4: Infinity,
};

export default function AiBansPage() {
  const [bans, setBans] = useState<AiBanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pardoning, setPardoning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/ai-bans");
    setBans(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handlePardon(ban: AiBanRow) {
    setPardoning(ban.id);
    const body: Record<string, string> = { banId: ban.id };
    if (ban.id.startsWith("orphan-")) body.userId = ban.userId;
    await fetch("/api/admin/ai-bans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPardoning(null);
    load();
  }

  const activeBans = bans.filter((b) => b.status === "ACTIVE");
  const pastBans = bans.filter((b) => b.status !== "ACTIVE");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Baneos AI</h1>
        <p className="text-sm text-zinc-500">Gestioná los bloqueos por uso indebido del asistente AI</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">
            Activos ({activeBans.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-zinc-400">Cargando...</div>
          ) : activeBans.length === 0 ? (
            <div className="px-5 pb-4 text-sm text-zinc-400">No hay baneos activos.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
                  <th className="px-5 py-2.5 text-left font-medium">Usuario</th>
                  <th className="px-5 py-2.5 text-left font-medium">Nivel</th>
                  <th className="px-5 py-2.5 text-left font-medium">Motivo</th>
                  <th className="px-5 py-2.5 text-left font-medium">Inicio</th>
                  <th className="px-5 py-2.5 text-left font-medium">Expira</th>
                  <th className="w-24 px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {activeBans.map((b) => {
                  const LevelIcon = LEVEL_ICONS[b.level] ?? Clock;
                  return (
                    <tr key={b.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-zinc-700">{b.user.displayName ?? b.user.username}</span>
                        <span className="ml-1.5 text-xs text-zinc-400">@{b.user.username}</span>
                        {b.id.startsWith("orphan-") && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Heredado
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          <LevelIcon className="h-3 w-3" />
                          {LEVEL_LABELS[b.level] ?? `Nivel ${b.level}`}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-zinc-600">{b.reason ?? "—"}</td>
                      <td className="px-5 py-2.5 text-xs text-zinc-400">{new Date(b.bannedAt).toLocaleString("es-AR")}</td>
                      <td className="px-5 py-2.5 text-xs text-zinc-400">
                        {b.level >= 4 ? (
                          <span className="text-red-500">Nunca</span>
                        ) : b.expiresAt ? (
                          new Date(b.expiresAt).toLocaleString("es-AR")
                        ) : "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <button
                          onClick={() => handlePardon(b)}
                          disabled={pardoning === b.id}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <ShieldOff className="h-3 w-3" />
                          Perdonar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">
            Historial ({pastBans.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pastBans.length === 0 ? (
            <div className="px-5 pb-4 text-sm text-zinc-400">No hay baneos previos.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
                  <th className="px-5 py-2.5 text-left font-medium">Usuario</th>
                  <th className="px-5 py-2.5 text-left font-medium">Nivel</th>
                  <th className="px-5 py-2.5 text-left font-medium">Estado</th>
                  <th className="px-5 py-2.5 text-left font-medium">Perdonado por</th>
                  <th className="px-5 py-2.5 text-left font-medium">Fin</th>
                </tr>
              </thead>
              <tbody>
                {pastBans.map((b) => {
                  const LevelIcon = LEVEL_ICONS[b.level] ?? Clock;
                  return (
                    <tr key={b.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-zinc-700">{b.user.displayName ?? b.user.username}</span>
                        <span className="ml-1.5 text-xs text-zinc-400">@{b.user.username}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                          <LevelIcon className="h-3 w-3" />
                          {LEVEL_LABELS[b.level] ?? `Nivel ${b.level}`}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          b.status === "PARDONED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}>
                          {b.status === "PARDONED" ? <ShieldCheck className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                          {b.status === "PARDONED" ? "Perdonado" : b.status === "EXPIRED" ? "Expirado" : b.status}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-zinc-600">
                        {b.pardonedBy?.username ?? "—"}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-zinc-400">
                        {b.pardonedAt
                          ? new Date(b.pardonedAt).toLocaleString("es-AR")
                          : b.expiresAt
                            ? new Date(b.expiresAt).toLocaleString("es-AR")
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
