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
        style={{ background: current?.color ?? "#94A3B8" }}
      />
      <select
        value={value}
        onChange={handleChange}
        disabled={pending}
        className="appearance-none pl-5 pr-2 py-0.5 text-[11px] rounded-full border-0 bg-transparent cursor-pointer
                   focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:opacity-50
                   hover:bg-zinc-100 transition-colors"
        style={{ color: current?.color ?? "#94A3B8" }}
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
