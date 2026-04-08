"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WINDOWS = [
  { label: "1 mes", value: 1 },
  { label: "3 meses", value: 3 },
  { label: "6 meses", value: 6 },
  { label: "12 meses", value: 12 },
];

export function DashboardFilter({
  currentMonth,
  currentMonths,
}: {
  currentMonth?: string;
  currentMonths?: number;
}) {
  const router = useRouter();

  // Determine what's active
  const activeMonths = currentMonth ? undefined : (currentMonths ?? 6);
  const activeMonth = currentMonth; // YYYY-MM

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(params);
    router.push(`/dashboard?${sp.toString()}`);
  }

  function setWindow(m: number) {
    navigate({ months: String(m) });
  }

  function setMonth(ym: string) {
    navigate({ month: ym });
  }

  // Month navigation
  const now = new Date();
  const currentYM = activeMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = currentYM.split("-").map(Number);

  function prevMonth() {
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function nextMonth() {
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const isCurrentMonth =
    currentYM === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Rolling window buttons */}
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
          onClick={() => setMonth(currentYM)}
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
    </div>
  );
}
