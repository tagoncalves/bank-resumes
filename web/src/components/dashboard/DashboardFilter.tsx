"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FilterPill } from "@/design-system/components/filter-pill";

const WINDOWS = [
  { label: "1 mes", value: 1 },
  { label: "3 meses", value: 3 },
  { label: "6 meses", value: 6 },
  { label: "12 meses", value: 12 },
];

const ORIGINS = [
  { label: "Todos", value: "all" },
  { label: "Manuales", value: "manual" },
  { label: "Resúmenes", value: "statement" },
  { label: "Recibos", value: "payslip" },
];

export function DashboardFilter({
  currentMonth,
  currentMonths,
  currentOrigin,
}: {
  currentMonth?: string;
  currentMonths?: number;
  currentOrigin?: string;
}) {
  const router = useRouter();
  const selectedOrigins = (currentOrigin ?? "all").split(",").filter(Boolean);

  // Determine what's active
  const activeMonths = currentMonth ? undefined : (currentMonths ?? 6);
  const activeMonth = currentMonth; // YYYY-MM

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(params);
    if (currentOrigin && currentOrigin !== "all" && !sp.has("origin")) {
      sp.set("origin", currentOrigin);
    }
    router.push(`/dashboard?${sp.toString()}`);
  }

  function setWindow(m: number) {
    navigate({ months: String(m) });
  }

  function setMonth(ym: string) {
    navigate({ month: ym });
  }

  function setOrigin(origin: string) {
    const nextOrigins = selectedOrigins.includes(origin)
      ? selectedOrigins.filter((item) => item !== origin)
      : [...selectedOrigins.filter((item) => item !== "all"), origin];
    const normalizedOrigins = nextOrigins.length ? nextOrigins : ["all"];
    const params: Record<string, string> = currentMonth
      ? { month: currentMonth }
      : { months: String(currentMonths ?? 6) };
    if (!normalizedOrigins.includes("all")) params.origin = normalizedOrigins.join(",");
    const sp = new URLSearchParams(params);
    router.push(`/dashboard?${sp.toString()}`);
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
    <div className="responsive-scroll -mx-3 flex items-center gap-2 px-3 sm:mx-0 sm:flex-wrap sm:px-0">
      {/* Rolling window buttons */}
      <div className="flex shrink-0 gap-1">
        {WINDOWS.map((w) => (
          <FilterPill
            key={w.value}
            onClick={() => setWindow(w.value)}
            active={activeMonths === w.value}
          >
            {w.label}
          </FilterPill>
        ))}
      </div>

      <div className="h-4 w-px shrink-0 bg-border" />

      {/* Month navigation */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={prevMonth}
          className="ds-icon-button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <FilterPill
          onClick={() => setMonth(currentYM)}
          active={!!activeMonth}
          className="min-w-[120px] capitalize"
        >
          {monthLabel}
        </FilterPill>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth && !!activeMonth}
          className="ds-icon-button disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="h-4 w-px shrink-0 bg-border" />

      <div className="flex shrink-0 gap-1">
        {ORIGINS.map((origin) => (
          <FilterPill
            key={origin.value}
            onClick={() => setOrigin(origin.value)}
            active={(currentOrigin ?? "all") === origin.value || (origin.value !== "all" && selectedOrigins.includes(origin.value))}
            tone="income"
          >
            {origin.label}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}
