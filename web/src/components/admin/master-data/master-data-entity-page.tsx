"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Bell,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Pencil,
  Plane,
  Receipt,
  Save,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Trash2,
  Utensils,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import type { MasterDataField } from "@/lib/admin/master-data";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type RowValue = string | number | boolean | null;
type MasterDataRow = Record<string, RowValue> & { id: string; createdAt?: string; updatedAt?: string };

type Metadata = {
  key: string;
  label: string;
  singularLabel: string;
  description: string;
  displayField: string;
  fields: MasterDataField[];
  readonlyFields: string[];
};

type EntityResponse = {
  metadata: Metadata;
  rows: MasterDataRow[];
};

const ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "shopping-cart", label: "Supermercado", Icon: ShoppingCart },
  { value: "shopping-bag", label: "Compras", Icon: ShoppingBag },
  { value: "utensils", label: "Comida", Icon: Utensils },
  { value: "coffee", label: "Café", Icon: Coffee },
  { value: "car", label: "Auto", Icon: Car },
  { value: "bus", label: "Transporte", Icon: Bus },
  { value: "bike", label: "Bicicleta", Icon: Bike },
  { value: "plane", label: "Viajes", Icon: Plane },
  { value: "home", label: "Hogar", Icon: Home },
  { value: "heart-pulse", label: "Salud", Icon: HeartPulse },
  { value: "dumbbell", label: "Gimnasio", Icon: Dumbbell },
  { value: "gamepad-2", label: "Entretenimiento", Icon: Gamepad2 },
  { value: "music", label: "Música", Icon: Music },
  { value: "shirt", label: "Ropa", Icon: Shirt },
  { value: "graduation-cap", label: "Educación", Icon: GraduationCap },
  { value: "book-open", label: "Libros", Icon: BookOpen },
  { value: "briefcase-business", label: "Trabajo", Icon: BriefcaseBusiness },
  { value: "laptop", label: "Tecnología", Icon: Laptop },
  { value: "smartphone", label: "Celular", Icon: Smartphone },
  { value: "credit-card", label: "Tarjeta", Icon: CreditCard },
  { value: "wallet-cards", label: "Billetera", Icon: WalletCards },
  { value: "banknote", label: "Efectivo", Icon: Banknote },
  { value: "landmark", label: "Banco", Icon: Landmark },
  { value: "receipt", label: "Factura", Icon: Receipt },
  { value: "tag", label: "Oferta", Icon: Tag },
  { value: "gift", label: "Regalos", Icon: Gift },
  { value: "shield", label: "Seguros", Icon: Shield },
  { value: "bell", label: "Servicios", Icon: Bell },
  { value: "paw-print", label: "Mascotas", Icon: PawPrint },
];

function findIconOption(value: RowValue | undefined) {
  if (!value) return null;
  return ICON_OPTIONS.find((option) => option.value === value) ?? null;
}

function displayDate(value: RowValue | undefined) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function emptyForm(metadata: Metadata) {
  return Object.fromEntries(
    metadata.fields.map((field) => [field.name, field.defaultValue ?? (field.type === "boolean" ? false : "")]),
  ) as Record<string, RowValue>;
}

function renderCellValue(field: MasterDataField, value: RowValue, row: MasterDataRow) {
  if (field.type === "boolean") return value ? "Sí" : "No";
  if (field.type === "color") {
    return value ? (
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border border-zinc-200" style={{ backgroundColor: String(value) }} />
        {String(value)}
      </span>
    ) : "-";
  }

  if (field.type === "icon") {
    const option = findIconOption(value);
    if (!value) return "-";
    if (!option) return String(value);
    const Icon = option.Icon;
    const color = typeof row.color === "string" && row.color ? row.color : "#71717a";
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50" title={option.label}>
        <Icon className="h-4 w-4" style={{ color }} />
      </span>
    );
  }

  const option = field.options?.find((item) => item.value === value);
  if (option) return option.label;

  return value ? String(value) : "-";
}

export function MasterDataEntityPage({ entityKey }: { entityKey: string }) {
  const { showToast } = useToast();
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [rows, setRows] = useState<MasterDataRow[]>([]);
  const [form, setForm] = useState<Record<string, RowValue>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<MasterDataRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingRow = useMemo(() => rows.find((row) => row.id === editingId) ?? null, [editingId, rows]);
  const usedIcons = useMemo(() => {
    return new Set(rows.map((row) => String(row.icon ?? "")).filter(Boolean));
  }, [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/master-data/${entityKey}`);
      const json = await res.json() as EntityResponse | { error?: string };
      const errorMessage = "error" in json ? json.error : undefined;
      if (!res.ok || !("metadata" in json)) throw new Error(errorMessage ?? "No se pudo cargar la entidad");
      setMetadata(json.metadata);
      setRows(json.rows ?? []);
      setForm((current) => Object.keys(current).length ? current : emptyForm(json.metadata));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey]);

  function startCreate() {
    if (!metadata) return;
    setEditingId(null);
    setForm(emptyForm(metadata));
    setIconPickerOpen(false);
    setError(null);
  }

  function startEdit(row: MasterDataRow) {
    if (!metadata) return;
    setEditingId(row.id);
    setForm(Object.fromEntries(metadata.fields.map((field) => [field.name, row[field.name] ?? ""])) as Record<string, RowValue>);
    setIconPickerOpen(false);
    setError(null);
  }

  function updateField(field: MasterDataField, value: RowValue) {
    setForm((current) => ({ ...current, [field.name]: value }));
  }

  async function save() {
    if (!metadata) return;
    setSaving(true);
    setError(null);
    try {
      const wasEditing = Boolean(editingId);
      const url = editingId ? `/api/admin/master-data/${entityKey}/${editingId}` : `/api/admin/master-data/${entityKey}`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: form }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar");
      await load();
      setEditingId(null);
      setForm(emptyForm(metadata));
      setIconPickerOpen(false);
      showToast({
        tone: "success",
        title: wasEditing ? "Registro actualizado" : "Registro creado",
        description: `${metadata.singularLabel} guardado correctamente.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: MasterDataRow) {
    if (!metadata) return;
    setConfirmDeleteRow(null);
    setSaving(true);
    setError(null);
    try {
      const label = String(row[metadata.displayField] ?? row.id);
      const res = await fetch(`/api/admin/master-data/${entityKey}/${row.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "No se pudo eliminar");
      if (editingId === row.id) startCreate();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  function renderInput(field: MasterDataField) {
    const value = form[field.name];
    const baseClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

    if (field.type === "boolean") {
      return (
        <label className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateField(field, e.target.checked)} />
          {field.label}
        </label>
      );
    }

    if (field.type === "select" || field.type === "relation") {
      return (
        <select value={String(value ?? "")} onChange={(e) => updateField(field, e.target.value)} className={baseClass}>
          <option value="">Seleccionar...</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }

    if (field.type === "color") {
      const colorValue = typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#6366f1";
      return (
        <div className="flex gap-2">
          <input type="color" value={colorValue} onChange={(e) => updateField(field, e.target.value)} className="h-10 w-12 rounded border border-zinc-300 bg-white p-1" />
          <input type="text" value={String(value ?? "")} onChange={(e) => updateField(field, e.target.value)} placeholder="#6366f1" className={baseClass} />
        </div>
      );
    }

    if (field.type === "icon") {
      const selected = findIconOption(value);
      const SelectedIcon = selected?.Icon;
      const selectedColor = typeof form.color === "string" && form.color ? form.color : "#71717a";

      return (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIconPickerOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none hover:bg-zinc-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <span className="flex items-center gap-2 text-zinc-700">
              {SelectedIcon ? <SelectedIcon className="h-4 w-4" style={{ color: selectedColor }} /> : <Tag className="h-4 w-4 text-zinc-300" />}
              {selected?.label ?? "Seleccionar ícono..."}
            </span>
            <span className="text-xs text-zinc-400">{value ? String(value) : "Opcional"}</span>
          </button>

          {iconPickerOpen && (
            <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  updateField(field, "");
                  setIconPickerOpen(false);
                }}
                className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50"
              >
                <span>Sin ícono</span>
                {!value && <span className="text-xs text-indigo-600">Actual</span>}
              </button>

              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {ICON_OPTIONS.map((option) => {
                  const Icon = option.Icon;
                  const selectedOption = value === option.value;
                  const used = usedIcons.has(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        updateField(field, option.value);
                        setIconPickerOpen(false);
                      }}
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                        selectedOption ? "bg-indigo-50 text-indigo-700" : "text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className={`h-4 w-4 shrink-0 ${selectedOption ? "text-indigo-600" : "text-zinc-400"}`} />
                        <span className="truncate">{option.label}</span>
                      </span>
                      {used && <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Usado</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={field.type === "number" ? "number" : "text"}
        value={String(value ?? "")}
        onChange={(e) => updateField(field, field.type === "number" ? e.target.value : e.target.value)}
        placeholder={field.placeholder}
        className={baseClass}
      />
    );
  }

  if (loading && !metadata) {
    return <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Cargando datos maestros...</div>;
  }

  if (!metadata) {
    return (
      <div className="space-y-4">
        <Link href="/admin/master-data" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error ?? "Entidad no encontrada"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/master-data" className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Datos maestros
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900">{metadata.label}</h1>
          <p className="mt-1 text-sm text-zinc-500">{metadata.description}</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">Registros</p>
            <p className="text-xs text-zinc-500">{rows.length} registros cargados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  {metadata.fields.map((field) => <th key={field.name} className="px-4 py-3 text-left font-medium">{field.label}</th>)}
                  <th className="px-4 py-3 text-left font-medium">Creado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={metadata.fields.length + 2} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No hay registros todavía.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className={editingId === row.id ? "bg-indigo-50/40" : "hover:bg-zinc-50"}>
                    {metadata.fields.map((field) => (
                      <td key={field.name} className="whitespace-nowrap px-4 py-3 text-zinc-700">
                        {renderCellValue(field, row[field.name], row)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{displayDate(row.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button type="button" onClick={() => startEdit(row)} className="mr-2 rounded p-1.5 text-zinc-400 hover:bg-white hover:text-indigo-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteRow(row)} className="rounded p-1.5 text-zinc-400 hover:bg-white hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{editingId ? `Editar ${metadata.singularLabel.toLowerCase()}` : `Nuevo ${metadata.singularLabel.toLowerCase()}`}</p>
              <p className="text-xs text-zinc-500">Formulario generado por metadata de la entidad.</p>
            </div>
            {editingId && (
              <button type="button" onClick={startCreate} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {metadata.fields.map((field) => (
              <div key={field.name}>
                {field.type !== "boolean" && (
                  <label className="mb-1 block text-xs font-medium text-zinc-500">
                    {field.label}{field.required ? " *" : ""}
                  </label>
                )}
                {renderInput(field)}
              </div>
            ))}
          </div>

          {editingRow && (
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
              <p>ID: <span className="font-mono">{editingRow.id}</span></p>
              <p>Creado: {displayDate(editingRow.createdAt)}</p>
              {editingRow.updatedAt && <p>Actualizado: {displayDate(editingRow.updatedAt)}</p>}
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDeleteRow !== null}
        onOpenChange={() => setConfirmDeleteRow(null)}
        onConfirm={() => confirmDeleteRow && remove(confirmDeleteRow)}
        title={`Eliminar ${metadata.singularLabel.toLowerCase()}`}
        description={
          confirmDeleteRow
            ? `\u00bfEliminar ${metadata.singularLabel.toLowerCase()} "${String(confirmDeleteRow[metadata.displayField] ?? confirmDeleteRow.id)}"?`
            : ""
        }
        confirmLabel="Eliminar"
        variant="destructive"
        loading={saving}
      />
    </div>
  );
}
