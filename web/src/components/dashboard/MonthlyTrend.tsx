"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { compactARS, formatARS } from "@/lib/formatters";

interface MonthData {
  month: string;
  totalSpending: number;
  transactionCount: number;
}

export default function MonthlyTrend({ data }: { data: MonthData[] }) {
  const router = useRouter();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">Tendencia mensual</CardTitle>
        </CardHeader>
        <CardContent className="flex h-52 items-center justify-center text-sm text-zinc-400">
          Sin datos
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.month + "-01").toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
  }));

  function handleBarClick(entry: { month?: string }) {
    if (!entry?.month) return;
    router.push(`/transactions?month=${entry.month}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-700">Tendencia mensual (ARS)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={formatted}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            onClick={(e) => {
              const payload = e?.activePayload?.[0]?.payload;
              if (payload) handleBarClick(payload);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis
              tickFormatter={(v) => compactARS(v)}
              tick={{ fontSize: 11, fill: "#71717a" }}
              width={60}
            />
            <Tooltip
              formatter={(value) => [formatARS(Number(value)), "Gastos"]}
              contentStyle={{ fontSize: 12, borderColor: "#e4e4e7" }}
              cursor={{ fill: "#e0e7ff", opacity: 0.5 }}
            />
            <Bar dataKey="totalSpending" fill="#6366f1" radius={[3, 3, 0, 0]} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-center text-[10px] text-zinc-400">Clic en una barra para ver movimientos del mes</p>
      </CardContent>
    </Card>
  );
}
