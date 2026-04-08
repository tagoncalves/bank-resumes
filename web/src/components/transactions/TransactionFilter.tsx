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
  const selectedCatIds = categoryIdsStr ? categoryIdsStr.split(",").filter(Boolean) : [];

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

  function buildUrl(month?: string, months?: number, catIds?: string[]) {
    const sp = new URLSearchParams();
    if (month) sp.set("month", month);
    else if (months) sp.set("months", String(months));
    if (catIds?.length) sp.set("categoryId", catIds.join(","));
    return `/transactions?${sp.toString()}`;
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
        selectedCatIds
      )
    );
  }

  function nextMonth() {
    const d = new Date(y, m, 1);
    router.push(
      buildUrl(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        undefined,
        selectedCatIds
      )
    );
  }

  function setWindow(w: number) {
    router.push(buildUrl(undefined, w, selectedCatIds));
  }

  function selectMonth() {
    router.push(buildUrl(currentYM, undefined, selectedCatIds));
  }

  function toggleCategory(id: string) {
    const newIds = selectedCatIds.includes(id)
      ? selectedCatIds.filter((x) => x !== id)
      : [...selectedCatIds, id];
    router.push(buildUrl(activeMonth, activeMonths, newIds));
  }

  function clearCategories() {
    router.push(buildUrl(activeMonth, activeMonths, []));
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
    </div>
  );
}
