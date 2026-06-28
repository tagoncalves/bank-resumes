"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2, Bot, User, Shield, Sparkles, Settings, X } from "lucide-react";
import ChatSettings, { useAISettings } from "@/components/ai/ChatSettings";
import { Button } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";

const STORAGE_KEY = "ai_chat_messages";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useAISettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [permanent, setPermanent] = useState(false);
  const [blockLevel, setBlockLevel] = useState(0);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.role === "ADMIN") setIsAdmin(true);
    }).catch(() => {});
    fetch("/api/ai/chat/status").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.blocked) {
        if (d.permanent) { setPermanent(true); setBlockLevel(d.blockLevel); }
        else if (d?.blockedUntil) setBlockedUntil(d.blockedUntil);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    if (!blockedUntil) { setCountdown(""); return; }
    const tick = () => {
      const remaining = blockedUntil - Date.now();
      if (remaining <= 0) { setBlockedUntil(null); setCountdown(""); return; }
      const totalSec = Math.ceil(remaining / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setCountdown(
        h > 0
          ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
          : `${m}m ${String(s).padStart(2, "0")}s`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  const isBlocked = (blockedUntil !== null && Date.now() < blockedUntil) || permanent;

  async function send() {
    const text = input.trim();
    if (!text || loading || isBlocked) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          settings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      if (data.misuse?.blocked) {
        if (data.misuse.permanent) { setPermanent(true); setBlockLevel(data.misuse.blockLevel); }
        else if (data.misuse?.blockedUntil) setBlockedUntil(data.misuse.blockedUntil);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err instanceof Error ? err.message : "Error de conexión con el servidor AI." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setBannerDismissed(false);
    setPermanent(false);
    setBlockLevel(0);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  const skillTotal = Object.keys(settings.skills).length;
  const activeSkillCount = Object.values(settings.skills).filter(Boolean).length;

  return (
    <div className="-m-3 flex h-full flex-col sm:-m-4 lg:-m-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/70 px-3 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-ai)_14%,var(--color-surface))]">
            <Sparkles className="h-4 w-4 text-ai" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground">AI Financiero</h1>
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-[11px] text-muted">DeepSeek · {settings.model}</p>
              {activeSkillCount < skillTotal && (
                <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10px] text-muted">
                  {activeSkillCount}/{skillTotal} skills
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() => setSettingsOpen(true)}
            variant="outline"
            size="sm"
            title="Configuración"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            onClick={clearChat}
            disabled={messages.length === 0 || isBlocked}
            variant="outline"
            size="sm"
            title={isBlocked ? `Bloqueado — restante: ${countdown}` : undefined}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden min-[380px]:inline">Nuevo chat</span>
          </Button>
        </div>
      </div>

      {/* Privacy banner */}
      {!bannerDismissed && (
        <div className="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--color-warning)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-surface))] px-6 py-2 text-[11px] text-warning">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            Tus datos no se almacenan en el servidor ni se usan para entrenar modelos. Esta conversación se guarda solo en tu navegador hasta que cierres la pestaña o inicies un nuevo chat.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="ds-icon-button text-warning hover:text-warning"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-sm text-center">
              <Sparkles className="mx-auto h-8 w-8 text-ai" />
              <p className="mt-2 text-sm font-medium text-foreground">Consultá sobre tus finanzas</p>
              <p className="mt-1 text-xs text-muted">
                Resúmenes, recibos, presupuesto, dólar, impuestos &mdash; todo en argentina.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-ai)_14%,var(--color-surface))]">
                <Bot className="h-4 w-4 text-ai" />
              </div>
            )}
            <div
              className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-ai text-white"
                  : "bg-surface-alt text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === "user" && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <User className="h-4 w-4 text-muted" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-ai)_14%,var(--color-surface))]">
              <Bot className="h-4 w-4 text-ai" />
            </div>
            <div className="rounded-xl bg-surface-alt px-4 py-2.5 text-sm text-muted">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">·</span>
                <span className="animate-bounce" style={{ animationDelay: "0.15s" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "0.3s" }}>·</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-surface/70 px-6 py-4 backdrop-blur">
        {permanent ? (
          <div className="flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--color-expense)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-expense)_12%,var(--color-surface))] px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-expense">AI bloqueado permanentemente</p>
              <p className="text-[11px] text-expense">
                Contactá a un administrador para revisar tu caso{blockLevel > 0 ? ` · nivel ${blockLevel}` : ""}.
              </p>
            </div>
          </div>
        ) : isBlocked ? (
          <div className="flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--color-expense)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-expense)_12%,var(--color-surface))] px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-expense">AI bloqueado por uso indebido</p>
              <p className="text-[11px] text-expense">Se restablece en {countdown}</p>
            </div>
            <div className="font-mono text-lg font-semibold tabular-nums text-expense">{countdown}</div>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu consulta..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              variant="ai"
            >
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </form>
        )}
      </div>

      {/* Settings modal */}
      <ChatSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        isAdmin={isAdmin}
      />
    </div>
  );
}
