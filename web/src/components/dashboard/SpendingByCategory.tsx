"use client";

import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatARS } from "@/lib/formatters";

interface CategoryData {
  categoryId: string;
  categoryName: string;
  color: string;
  total: number;
  transactionCount: number;
  percentage: number;
}

interface Props {
  data: CategoryData[];
  currentMonth?: string;
  currentMonths?: number;
}

export default function SpendingByCategory({ data, currentMonth, currentMonths }: Props) {
  const router = useRouter();

  function navigateToCategory(categoryId: string) {
    const sp = new URLSearchParams();
    if (currentMonth) sp.set("month", currentMonth);
    else if (currentMonths) sp.set("months", String(currentMonths));
    if (categoryId && categoryId !== "unknown") sp.set("categoryId", categoryId);
    router.push(`/transactions?${sp.toString()}`);
  }

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">Gastos por categoría</CardTitle>
        </CardHeader>
        <CardContent className="flex h-52 items-center justify-center text-sm text-zinc-400">
          Sin datos
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-700">Gastos por categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={2}
              dataKey="total"
              nameKey="categoryName"
              cursor="pointer"
              onClick={(entry: CategoryData) => navigateToCategory(entry.categoryId)}
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatARS(Number(value)), "Total"]}
              contentStyle={{ fontSize: 12, borderColor: "#e4e4e7" }}
            />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-zinc-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 space-y-1">
          {data.slice(0, 5).map((d) => (
            <button
              key={d.categoryId}
              onClick={() => navigateToCategory(d.categoryId)}
              className="flex w-full items-center justify-between text-xs rounded px-1 py-0.5 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: d.color }}
                />
                <span className="text-zinc-600">{d.categoryName}</span>
              </div>
              <span className="font-mono text-zinc-700">{formatARS(d.total)}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-zinc-400">Clic para ver movimientos de la categoría</p>
      </CardContent>
    </Card>
  );
}
