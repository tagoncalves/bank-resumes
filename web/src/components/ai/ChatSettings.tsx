"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, X, Shield, ChevronDown, Check } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Textarea } from "@/design-system/components/textarea";

export type AISettings = {
  skills: Record<string, boolean>;
  model: string;
  temperature: number;
  adminPromptOverride: string;
};

const STORAGE_KEY = "ai_chat_settings";

const SKILL_OPTIONS = [
  { id: "banking-expert", label: "Conocimiento bancario", desc: "Banca argentina, tarjetas, préstamos, regulación, seguridad" },
  { id: "cotizacion-dolar-argentina", label: "Cotización del dólar", desc: "Dólar oficial, blue, MEP, CCL, tarjeta, cripto y monedas" },
  { id: "inflacion-argentina-ipc", label: "Inflación IPC", desc: "Serie histórica de inflación mensual argentina" },
] as const;

const DEFAULT_SETTINGS: AISettings = {
  skills: Object.fromEntries(SKILL_OPTIONS.map((s) => [s.id, true])),
  model: "deepseek-chat",
  temperature: 0.7,
  adminPromptOverride: "",
};

function loadSettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults to pick up new skills
      return { ...DEFAULT_SETTINGS, ...parsed, skills: { ...DEFAULT_SETTINGS.skills, ...parsed.skills } };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings] as const;
}

function SkillMultiselect({
  skills,
  onChange,
}: {
  skills: Record<string, boolean>;
  onChange: (s: Record<string, boolean>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const active = SKILL_OPTIONS.filter((s) => skills[s.id]);
  const inactive = SKILL_OPTIONS.filter((s) => !skills[s.id]);

  function toggle(id: string) {
    onChange({ ...skills, [id]: !skills[id] });
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ds-input flex items-center justify-between"
      >
        <span className="text-foreground">
          {active.length === SKILL_OPTIONS.length
            ? "Todas las skills"
            : active.length === 0
              ? "Ninguna skill"
              : `${active.length} de ${SKILL_OPTIONS.length} skills`}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-[var(--radius-md)] border border-border bg-surface shadow-lg">
          {SKILL_OPTIONS.map((skill) => {
            const isSelected = !!skills[skill.id];
            return (
              <label
                key={skill.id}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-alt first:rounded-t-[var(--radius-md)] last:rounded-b-[var(--radius-md)] ${
                  isSelected ? "bg-[var(--color-selected)]" : ""
                }`}
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  isSelected ? "border-ai bg-ai" : "border-border"
                }`}>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{skill.label}</p>
                  <p className="truncate text-[11px] text-muted">{skill.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Chips */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {active.map((skill) => (
          <span
            key={skill.id}
            className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-ai)_14%,var(--color-surface))] px-2.5 py-0.5 text-[11px] font-medium text-ai"
          >
            {skill.label}
            <button
              onClick={() => toggle(skill.id)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-[color-mix(in_srgb,var(--color-ai)_20%,var(--color-surface))]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {inactive.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-surface-alt px-2.5 py-0.5 text-[11px] text-muted">
            +{inactive.length} ocultas
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChatSettings({
  open,
  onClose,
  settings,
  onSettingsChange,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  settings: AISettings;
  onSettingsChange: (s: AISettings) => void;
  isAdmin: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[var(--radius-xl)] border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-ai" />
            <h2 className="text-sm font-semibold text-foreground">Configuración del AI</h2>
          </div>
          <button onClick={onClose} className="ds-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-4">
          {/* Skills */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Skills activas</p>
            <SkillMultiselect
              skills={settings.skills}
              onChange={(skills) => onSettingsChange({ ...settings, skills })}
            />
          </div>

          {/* Model */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Modelo</p>
            <select
              value={settings.model}
              onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
              className="ds-input"
            >
              <option value="deepseek-chat">DeepSeek Chat</option>
              <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
            </select>
            <div className="mt-3">
              <label className="text-xs text-muted">Temperatura: {settings.temperature}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.temperature}
                onChange={(e) => onSettingsChange({ ...settings, temperature: parseFloat(e.target.value) })}
                className="w-full accent-ai"
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>Preciso</span>
                <span>Creativo</span>
              </div>
            </div>
          </div>

          {/* Admin section */}
          {isAdmin && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="h-3.5 w-3.5 text-warning" />
                <p className="text-xs font-semibold uppercase tracking-wide text-warning">Admin</p>
              </div>
              <label className="block">
                <p className="mb-1 text-xs text-muted">System prompt adicional (se agrega al final)</p>
                <Textarea
                  value={settings.adminPromptOverride}
                  onChange={(e) => onSettingsChange({ ...settings, adminPromptOverride: e.target.value })}
                  rows={4}
                  className="font-mono text-xs focus:border-warning"
                  placeholder="Instrucciones adicionales para el modelo..."
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 text-right">
          <Button
            onClick={onClose}
            variant="ai"
          >
            Listo
          </Button>
        </div>
      </div>
    </div>
  );
}
