"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";

const WINDOWS = [
  { label: "1 mes", value: 1 },
  { label: "3 meses", value: 3 },
  { label: "6 meses", value: 6 },
  { label: "12 meses", value: 12 },
];

interface Category {
  id: string;
  name: string;
  color: string;
}

const ORIGINS = [
  { label: "Manuales", value: "manual" },
  { label: "Resúmenes", value: "statement" },
  { label: "Recibos", value: "payslip" },
];

const TYPES = [
  { label: "Gastos", value: "DEBIT" },
  { label: "Ingresos", value: "CREDIT" },
];

export function TransactionFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  const currentMonth = searchParams.get("month") ?? undefined;
  const rawMonths = searchParams.get("months");
  const currentMonths = rawMonths ? parseInt(rawMonths, 10) : undefined;
  const categoryIdsStr = searchParams.get("categoryId") ?? "";
  const originStr = searchParams.get("origin") ?? "";
  const typeStr = searchParams.get("type") ?? "";
  const selectedCatIds = categoryIdsStr ? categoryIdsStr.split(",").filter(Boolean) : [];
  const selectedOrigins = originStr ? originStr.split(",").filter(Boolean) : [];
  const selectedTypes = typeStr ? typeStr.split(",").filter(Boolean) : [];

  const activeMonths = currentMonth ? undefined : (currentMonths ?? 6);
  const activeMonth = currentMonth;

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function buildUrl(month?: string, months?: number, catIds?: string[], origins?: string[], types?: string[]) {
    const sp = new URLSearchParams(searchParams.toString());
    if (month) {
      sp.set("month", month);
      sp.delete("months");
    } else if (months) {
      sp.delete("month");
      sp.set("months", String(months));
    } else {
      sp.delete("month");
      sp.delete("months");
    }
    if (catIds?.length) sp.set("categoryId", catIds.join(","));
    else sp.delete("categoryId");
    if (origins?.length) sp.set("origin", origins.join(","));
    else sp.delete("origin");
    if (types?.length) sp.set("type", types.join(","));
    else sp.delete("type");
    const query = sp.toString();
    return query ? `/transactions?${query}` : "/transactions";
  }

  const now = new Date();
  const currentYM =
    activeMonth ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = currentYM.split("-").map(Number);

  function prevMonth() {
    const d = new Date(y, m - 2, 1);
    router.push(
      buildUrl(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        undefined,
        selectedCatIds,
        selectedOrigins,
        selectedTypes
      )
    );
  }

  function nextMonth() {
    const d = new Date(y, m, 1);
    router.push(
      buildUrl(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        undefined,
        selectedCatIds,
        selectedOrigins,
        selectedTypes
      )
    );
  }

  function setWindow(w: number) {
    router.push(buildUrl(undefined, w, selectedCatIds, selectedOrigins, selectedTypes));
  }

  function selectMonth() {
    router.push(buildUrl(currentYM, undefined, selectedCatIds, selectedOrigins, selectedTypes));
  }

  function toggleCategory(id: string) {
    const newIds = selectedCatIds.includes(id)
      ? selectedCatIds.filter((x) => x !== id)
      : [...selectedCatIds, id];
    router.push(buildUrl(activeMonth, activeMonths, newIds, selectedOrigins, selectedTypes));
  }

  function clearCategories() {
    router.push(buildUrl(activeMonth, activeMonths, [], selectedOrigins, selectedTypes));
  }

  function toggleOrigin(origin: string) {
    const newOrigins = selectedOrigins.includes(origin)
      ? selectedOrigins.filter((item) => item !== origin)
      : [...selectedOrigins, origin];
    router.push(buildUrl(activeMonth, activeMonths, selectedCatIds, newOrigins, selectedTypes));
  }

  function toggleType(type: string) {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((item) => item !== type)
      : [...selectedTypes, type];
    router.push(buildUrl(activeMonth, activeMonths, selectedCatIds, selectedOrigins, newTypes));
  }

  const isCurrentMonth =
    currentYM ===
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Rolling window */}
      <div className="flex gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            onClick={() => setWindow(w.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeMonths === w.value
                ? "bg-indigo-100 text-indigo-700"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-zinc-200" />

      {/* Month navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={prevMonth}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={selectMonth}
          className={`min-w-[120px] rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
            activeMonth
              ? "bg-indigo-100 text-indigo-700"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          }`}
        >
          {monthLabel}
        </button>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth && !!activeMonth}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="h-4 w-px bg-zinc-200" />

      {/* Category multi-select */}
      <div className="relative" ref={catRef}>
        <button
          onClick={() => setCatOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedCatIds.length > 0
              ? "bg-indigo-100 text-indigo-700"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          }`}
        >
          {selectedCatIds.length > 0
            ? `${selectedCatIds.length} categoría${selectedCatIds.length > 1 ? "s" : ""}`
            : "Categorías"}
          <ChevronDown className="h-3 w-3" />
        </button>

        {catOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 w-52 rounded-lg border border-zinc-200 bg-white shadow-md py-1">
            {selectedCatIds.length > 0 && (
              <>
                <button
                  onClick={clearCategories}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-50"
                >
                  <X className="h-3 w-3" /> Limpiar selección
                </button>
                <div className="mx-3 border-t border-zinc-100 my-1" />
              </>
            )}
            {categories.map((cat) => {
              const selected = selectedCatIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-50 ${
                    selected ? "text-zinc-800" : "text-zinc-600"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-all"
                    style={
                      selected
                        ? { background: cat.color, borderColor: cat.color }
                        : { borderColor: cat.color, background: "transparent" }
                    }
                  />
                  {cat.name}
                  {selected && (
                    <span className="ml-auto text-indigo-500 text-[10px]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected category chips */}
      {selectedCatIds.length > 0 &&
        categories
          .filter((c) => selectedCatIds.includes(c.id))
          .map((cat) => (
            <span
              key={cat.id}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: `${cat.color}20`, color: cat.color }}
            >
              {cat.name}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="ml-0.5 hover:opacity-70"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}

      <div className="h-4 w-px bg-zinc-200" />

      <div className="flex gap-1">
        {ORIGINS.map((origin) => (
          <button
            key={origin.value}
            onClick={() => toggleOrigin(origin.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedOrigins.includes(origin.value)
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            {origin.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-zinc-200" />

      <div className="flex gap-1">
        {TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => toggleType(type.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTypes.includes(type.value)
                ? type.value === "CREDIT"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
}
