"use client";

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
}

export default function SpendingByCategory({ data }: Props) {
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
            <div key={d.categoryId} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: d.color }}
                />
                <span className="text-zinc-600">{d.categoryName}</span>
              </div>
              <span className="font-mono text-zinc-700">{formatARS(d.total)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
