"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  Line,
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
  income: number;
  expenses: number;
  netBalance: number;
  transactionCount: number;
}

export default function MonthlyTrend({ data }: { data: MonthData[] }) {
  const router = useRouter();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-700">Balance mensual</CardTitle>
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
  let runningBalance = 0;
  const withRunningBalance = formatted.map((item) => {
    runningBalance += item.netBalance;
    return { ...item, cumulativeNetBalance: runningBalance };
  });

  function handleBarClick(entry: { month?: string }) {
    if (!entry?.month) return;
    router.push(`/dashboard?month=${entry.month}`);
  }

  function extractPayload(event: unknown): { month?: string } | null {
    if (!event || typeof event !== "object") return null;

    const activePayload = (event as { activePayload?: Array<{ payload?: { month?: string } }> }).activePayload;
    return activePayload?.[0]?.payload ?? null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-700">Balance mensual (ARS)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={withRunningBalance}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            onClick={(e) => {
              const payload = extractPayload(e);
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
              formatter={(value, _name, item) => {
                const payload = item?.payload as MonthData | undefined;
                return [formatARS(Number(value)), payload ? `Ingresos ${formatARS(payload.income)} · Egresos ${formatARS(payload.expenses)}` : "Balance"];
              }}
              contentStyle={{ fontSize: 12, borderColor: "#e4e4e7" }}
              cursor={{ fill: "#e0e7ff", opacity: 0.5 }}
            />
            <Bar dataKey="netBalance" fill="#6366f1" radius={[3, 3, 0, 0]} cursor="pointer" />
            <Line type="monotone" dataKey="cumulativeNetBalance" stroke="#10B981" strokeWidth={2} dot={false} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-center text-[10px] text-zinc-400">Clic en una barra para filtrar el dashboard por mes</p>
      </CardContent>
    </Card>
  );
}
