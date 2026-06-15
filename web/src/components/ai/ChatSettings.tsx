"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, X, Shield, ChevronDown, Check } from "lucide-react";

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
        className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      >
        <span className="text-zinc-700">
          {active.length === SKILL_OPTIONS.length
            ? "Todas las skills"
            : active.length === 0
              ? "Ninguna skill"
              : `${active.length} de ${SKILL_OPTIONS.length} skills`}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-zinc-200 bg-white shadow-lg">
          {SKILL_OPTIONS.map((skill) => {
            const isSelected = !!skills[skill.id];
            return (
              <label
                key={skill.id}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-zinc-50 first:rounded-t-lg last:rounded-b-lg ${
                  isSelected ? "bg-indigo-50/50" : ""
                }`}
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  isSelected ? "border-indigo-600 bg-indigo-600" : "border-zinc-300"
                }`}>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800">{skill.label}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{skill.desc}</p>
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
            className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700"
          >
            {skill.label}
            <button
              onClick={() => toggle(skill.id)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {inactive.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] text-zinc-400">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Configuración del AI</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-4">
          {/* Skills */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Skills activas</p>
            <SkillMultiselect
              skills={settings.skills}
              onChange={(skills) => onSettingsChange({ ...settings, skills })}
            />
          </div>

          {/* Model */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Modelo</p>
            <select
              value={settings.model}
              onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="deepseek-chat">DeepSeek Chat</option>
              <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
            </select>
            <div className="mt-3">
              <label className="text-xs text-zinc-500">Temperatura: {settings.temperature}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.temperature}
                onChange={(e) => onSettingsChange({ ...settings, temperature: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Preciso</span>
                <span>Creativo</span>
              </div>
            </div>
          </div>

          {/* Admin section */}
          {isAdmin && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="h-3.5 w-3.5 text-amber-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Admin</p>
              </div>
              <label className="block">
                <p className="mb-1 text-xs text-zinc-500">System prompt adicional (se agrega al final)</p>
                <textarea
                  value={settings.adminPromptOverride}
                  onChange={(e) => onSettingsChange({ ...settings, adminPromptOverride: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 font-mono"
                  placeholder="Instrucciones adicionales para el modelo..."
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
