"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Bell, Mail, Play, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EmailTemplateEditor = dynamic(
  () => import("@/components/admin/notifications/email-template-editor").then((mod) => mod.EmailTemplateEditor),
  {
    ssr: false,
    loading: () => <div className="rounded border border-zinc-200 p-6 text-sm text-zinc-400">Cargando editor visual...</div>,
  },
);

interface ChannelItem { id: string; name: string; type: string; enabled: boolean; isDefault: boolean; configJson: string | null }
interface TemplateItem { id: string; eventType: string; subject: string | null; body: string; bodyFormat: string; enabled: boolean; channel: { name: string; type: string } }
interface EventItem { id: string; eventType: string; status: string; scheduledFor: string; createdAt: string; deliveries: unknown[] }
interface DeliveryItem { id: string; status: string; recipient: string; renderedSubject: string | null; renderedBody: string; lastError: string | null; createdAt: string; sentAt: string | null; channel: { name: string }; event?: { eventType: string } }
type Scope = "day" | "week" | "month";
const SCOPE_LABELS: Record<Scope, string> = { day: "Día", week: "Semana", month: "Mes" };

export default function NotificationsAdminPage() {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<DeliveryItem[]>([]);
  const [sentDeliveries, setSentDeliveries] = useState<DeliveryItem[]>([]);
  const [pendingScope, setPendingScope] = useState<Scope>("day");
  const [sentScope, setSentScope] = useState<Scope>("day");
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [templateEditMode, setTemplateEditMode] = useState<"visual" | "code">("visual");
  const [editingChannel, setEditingChannel] = useState<ChannelItem | null>(null);
  const [channelConfig, setChannelConfig] = useState({ provider: "console", from: "", defaultRecipient: "", apiKeyEnv: "RESEND_API_KEY" });
  const [error, setError] = useState<string | null>(null);

  function parseChannelConfig(channel: ChannelItem) {
    try {
      return channel.configJson ? JSON.parse(channel.configJson) as { provider?: string; from?: string; defaultRecipient?: string; apiKeyEnv?: string } : {};
    } catch {
      return {};
    }
  }

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/notifications?pendingScope=${pendingScope}&sentScope=${sentScope}`);
    const data = await res.json();
    setChannels(data.channels ?? []);
    setTemplates(data.templates ?? []);
    setEvents(data.events ?? []);
    setPendingDeliveries(data.pendingDeliveries ?? []);
    setSentDeliveries(data.sentDeliveries ?? []);
    setLoading(false);
  }

  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : "Error")); }, [pendingScope, sentScope]);

  async function processNow() {
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "process" }),
    });
    load();
  }

  async function toggleChannel(channel: ChannelItem) {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id, enabled: !channel.enabled }),
    });
    load();
  }

  async function saveTemplate() {
    if (!editingTemplate) return;
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: editingTemplate.id,
        subject: editingTemplate.subject,
        body: editingTemplate.body,
        enabled: editingTemplate.enabled,
      }),
    });
    setEditingTemplate(null);
    load();
  }

  function startEditChannel(channel: ChannelItem) {
    const config = parseChannelConfig(channel);
    setEditingChannel(channel);
    setChannelConfig({
      provider: config.provider ?? "console",
      from: config.from ?? "",
      defaultRecipient: config.defaultRecipient ?? "",
      apiKeyEnv: config.apiKeyEnv ?? "RESEND_API_KEY",
    });
  }

  async function saveChannel() {
    if (!editingChannel) return;
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: editingChannel.id,
        config: channelConfig,
      }),
    });
    setEditingChannel(null);
    load();
  }

  async function resendDelivery(deliveryId: string) {
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend", deliveryId }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Notificaciones</h1>
          <p className="text-sm text-zinc-500">Configurar medios de envío, templates y revisar auditoría de notificaciones.</p>
        </div>
        <button onClick={processNow} className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
          <Play className="h-4 w-4" /> Procesar cola
        </button>
      </div>

      {error && <Card className="border-red-200"><CardContent className="py-3 text-sm text-red-600">{error}</CardContent></Card>}

      <Card>
        <CardHeader><CardTitle className="text-sm">Medios de envío</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-zinc-400">Cargando...</p> : channels.map((c) => {
            const config = parseChannelConfig(c);
            return (
            <div key={c.id} className="rounded border border-zinc-200 p-3 text-sm">
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-zinc-400" />
                <div>
                  <p className="font-medium text-zinc-800">{c.name}</p>
                  <p className="text-xs text-zinc-500">{c.type}{c.isDefault ? " · default" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEditChannel(c)} className="rounded border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50">Configurar</button>
                <button
                  onClick={() => toggleChannel(c)}
                  className={`rounded px-3 py-1 text-xs ${c.enabled ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
                >
                  {c.enabled ? "Activo" : "Inactivo"}
                </button>
              </div>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                <p>Proveedor: <span className="font-mono text-zinc-700">{config.provider || "console"}</span></p>
                <p>Remitente: <span className="font-mono text-zinc-700">{config.from || "No configurado"}</span></p>
                <p>Destinatario default: <span className="font-mono text-zinc-700">{config.defaultRecipient || "Usuario / env"}</span></p>
                <p>API key env: <span className="font-mono text-zinc-700">{config.apiKeyEnv || "RESEND_API_KEY"}</span></p>
              </div>
            </div>
            );
          })}
          <p className="text-xs text-zinc-400">MVP: email default. WhatsApp/Telegram se agregan como nuevos carriers sobre esta misma estructura.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Templates por medio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded border border-zinc-200 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-800"><Bell className="mr-1 inline h-4 w-4" />{t.eventType}</p>
                  <p className="text-xs text-zinc-500">{t.channel.name} · {t.bodyFormat}</p>
                </div>
                <button onClick={() => { setEditingTemplate(t); setTemplateEditMode(t.bodyFormat === "HTML" ? "visual" : "code"); }} className="text-indigo-600 hover:underline">Editar</button>
              </div>
              <p className="text-xs text-zinc-500">{t.subject}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <DeliveryList
        title="Envíos pendientes"
        scope={pendingScope}
        onScopeChange={setPendingScope}
        deliveries={pendingDeliveries}
        empty="No hay envíos pendientes para el período seleccionado."
      />

      <DeliveryList
        title="Envíos realizados"
        scope={sentScope}
        onScopeChange={setSentScope}
        deliveries={sentDeliveries}
        empty="No hay envíos realizados para el período seleccionado."
        onResend={resendDelivery}
      />

      <Card>
        <CardHeader><CardTitle className="text-sm">Eventos recientes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="rounded border border-zinc-200 p-3 text-xs">
              <p className="font-medium text-zinc-700">{e.eventType} · {e.status}</p>
              <p className="text-zinc-400">Programado: {new Date(e.scheduledFor).toLocaleString("es-AR")} · deliveries: {e.deliveries.length}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded bg-white p-5 shadow-xl">
            <h2 className="mb-3 text-sm font-semibold">Editar template</h2>
            <label className="mb-1 block text-xs text-zinc-500">Asunto</label>
            <input className="mb-3 w-full rounded border px-3 py-2 text-sm" value={editingTemplate.subject ?? ""} onChange={(e) => setEditingTemplate((t) => t ? { ...t, subject: e.target.value } : t)} />
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs text-zinc-500">Cuerpo ({editingTemplate.bodyFormat})</label>
              {editingTemplate.bodyFormat === "HTML" && (
                <div className="flex rounded-full bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setTemplateEditMode("visual")}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${templateEditMode === "visual" ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-500"}`}
                  >
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateEditMode("code")}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${templateEditMode === "code" ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-500"}`}
                  >
                    Código HTML
                  </button>
                </div>
              )}
            </div>
            {editingTemplate.bodyFormat === "HTML" && templateEditMode === "visual" ? (
              <EmailTemplateEditor
                key={editingTemplate.id}
                value={editingTemplate.body}
                onChange={(body) => setEditingTemplate((t) => t ? { ...t, body } : t)}
              />
            ) : (
              <textarea className="h-72 w-full rounded border px-3 py-2 font-mono text-xs" value={editingTemplate.body} onChange={(e) => setEditingTemplate((t) => t ? { ...t, body: e.target.value } : t)} />
            )}
            <p className="mt-2 text-xs text-zinc-400">Variables disponibles: {"{{merchantName}}"}, {"{{amount}}"}, {"{{dueDate}}"}, {"{{confirmUrl}}"}, {"{{rejectUrl}}"}, {"{{categoryName}}"}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingTemplate(null)} className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">Cancelar</button>
              <button onClick={saveTemplate} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {editingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-sm font-semibold">Configurar {editingChannel.name}</h2>
            <p className="mb-4 text-xs text-zinc-500">El envío se hace server-side. No usa mailto. En desarrollo podés usar consola; para envío real configurá Resend y una API key en variables de entorno.</p>
            <label className="mb-1 block text-xs text-zinc-500">Proveedor</label>
            <select
              className="mb-3 w-full rounded border px-3 py-2 text-sm"
              value={channelConfig.provider}
              onChange={(e) => setChannelConfig((c) => ({ ...c, provider: e.target.value }))}
            >
              <option value="console">Consola (desarrollo, no envía mail real)</option>
              <option value="resend">Resend</option>
            </select>
            <label className="mb-1 block text-xs text-zinc-500">Remitente</label>
            <input
              className="mb-3 w-full rounded border px-3 py-2 text-sm"
              value={channelConfig.from}
              onChange={(e) => setChannelConfig((c) => ({ ...c, from: e.target.value }))}
              placeholder="Bank Resumes <no-reply@example.com>"
            />
            <label className="mb-1 block text-xs text-zinc-500">Destinatario default</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={channelConfig.defaultRecipient}
              onChange={(e) => setChannelConfig((c) => ({ ...c, defaultRecipient: e.target.value }))}
              placeholder="admin@example.com o +549..."
            />
            {channelConfig.provider === "resend" && (
              <>
                <label className="mb-1 mt-3 block text-xs text-zinc-500">Variable de entorno API key</label>
                <input
                  className="w-full rounded border px-3 py-2 text-sm font-mono"
                  value={channelConfig.apiKeyEnv}
                  onChange={(e) => setChannelConfig((c) => ({ ...c, apiKeyEnv: e.target.value }))}
                  placeholder="RESEND_API_KEY"
                />
                <p className="mt-1 text-xs text-zinc-400">Por seguridad no se guarda el secreto en la base; agregá esa variable en `.env`.</p>
              </>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingChannel(null)} className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">Cancelar</button>
              <button onClick={saveChannel} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryList({
  title,
  scope,
  onScopeChange,
  deliveries,
  empty,
  onResend,
}: {
  title: string;
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  deliveries: DeliveryItem[];
  empty: string;
  onResend?: (deliveryId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="flex rounded-full bg-zinc-100 p-1">
            {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => onScopeChange(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  scope === s ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {deliveries.length === 0 ? (
          <p className="rounded border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-400">{empty}</p>
        ) : deliveries.map((d) => (
          <div key={d.id} className="grid gap-2 rounded border border-zinc-200 p-3 text-xs sm:grid-cols-[1fr_auto]">
            <div>
              <p className="font-medium text-zinc-700">{d.event?.eventType ?? "Notificación"} · {d.channel.name}</p>
              <p className="text-zinc-500">{d.renderedSubject ?? "Sin asunto"}</p>
              <p className="text-zinc-400">Para: {d.recipient}</p>
              {d.lastError && <p className="mt-1 text-red-500">{d.lastError}</p>}
            </div>
            <div className="text-left sm:text-right">
              <div className="flex items-center gap-2 sm:justify-end">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(d.status)}`}>{d.status}</span>
                {onResend && d.status === "SENT" && (
                  <button
                    type="button"
                    onClick={() => onResend(d.id)}
                    title="Reenviar"
                    className="rounded-full border border-indigo-100 p-1 text-indigo-600 hover:bg-indigo-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-zinc-400">{new Date(d.sentAt ?? d.createdAt).toLocaleString("es-AR")}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function statusClass(status: string) {
  if (status === "SENT") return "bg-emerald-50 text-emerald-700";
  if (status === "FAILED") return "bg-red-50 text-red-700";
  if (status === "RETRYING") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}
