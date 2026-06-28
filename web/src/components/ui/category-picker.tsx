"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; color: string | null };

export function CategoryPicker({
  transactionId,
  currentCategoryId,
  categories,
}: {
  transactionId: string;
  currentCategoryId: string | null | undefined;
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentCategoryId ?? "");

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value || null;
    setValue(e.target.value);
    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: newId }),
    });
    startTransition(() => router.refresh());
  }

  const current = categories.find((c) => c.id === value);

  return (
    <div className="relative inline-flex items-center">
      <span
        className="absolute left-2 h-1.5 w-1.5 rounded-full pointer-events-none"
        style={{ background: current?.color ?? "var(--color-muted)" }}
      />
      <select
        value={value}
        onChange={handleChange}
        disabled={pending}
        className="cursor-pointer appearance-none rounded-full border-0 bg-transparent py-0.5 pl-5 pr-2 text-[11px] transition-colors hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        style={{ color: current?.color ?? "var(--color-muted)" }}
      >
        <option value="">Sin categoría</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  );
}
