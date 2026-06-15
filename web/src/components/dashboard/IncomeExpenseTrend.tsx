"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { compactARS, formatARS } from "@/lib/formatters";

interface MonthData {
  month: string;
  income: number;
  expenses: number;
  netBalance: number;
}

export default function IncomeExpenseTrend({ data }: { data: MonthData[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">Ingresos vs egresos</CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center text-sm text-zinc-400">
          Sin datos
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(`${d.month}-01`).toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-700">Ingresos vs egresos</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tickFormatter={(v) => compactARS(v)} tick={{ fontSize: 11, fill: "#71717a" }} width={60} />
            <Tooltip
              formatter={(value, name) => [formatARS(Number(value)), name === "income" ? "Ingresos" : "Egresos"]}
              contentStyle={{ fontSize: 12, borderColor: "#e4e4e7" }}
            />
            <Legend formatter={(value) => <span className="text-xs text-zinc-600">{value === "income" ? "Ingresos" : "Egresos"}</span>} />
            <Bar dataKey="income" fill="#10B981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" fill="#EF4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
