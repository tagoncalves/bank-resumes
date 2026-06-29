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
  cashflowBalance?: number;
  cashOutflow?: number;
  transactionCount: number;
}

export default function MonthlyTrend({ data }: { data: MonthData[] }) {
  const router = useRouter();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Balance mensual</CardTitle>
        </CardHeader>
        <CardContent className="flex h-52 items-center justify-center text-sm text-muted">
          Sin datos
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.month + "-01").toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
  }));
  const withRunningBalance = formatted.reduce<{
    items: Array<MonthData & { label: string; cumulativeNetBalance: number }>;
    runningBalance: number;
  }>((acc, item) => {
    const cumulativeNetBalance = acc.runningBalance + item.netBalance;
    return {
      runningBalance: cumulativeNetBalance,
      items: [...acc.items, { ...item, cumulativeNetBalance }],
    };
  }, { items: [], runningBalance: 0 }).items;

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
        <CardTitle className="text-sm font-medium text-foreground">Balance mensual (ARS)</CardTitle>
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
            <YAxis
              tickFormatter={(v) => compactARS(v)}
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
              width={60}
            />
            <Tooltip
              formatter={(value, _name, item) => {
                const payload = item?.payload as MonthData | undefined;
                return [formatARS(Number(value)), payload ? `Ingresos ${formatARS(payload.income)} · Gastos ${formatARS(payload.expenses)}${payload.cashOutflow != null ? ` · Salida caja ${formatARS(payload.cashOutflow)}` : ""}` : "Balance"];
              }}
              contentStyle={{ fontSize: 12, borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" }}
              cursor={{ fill: "var(--color-selected)", opacity: 0.65 }}
            />
            <Bar dataKey="netBalance" fill="var(--color-primary)" radius={[3, 3, 0, 0]} cursor="pointer" />
            <Line type="monotone" dataKey="cumulativeNetBalance" stroke="var(--color-income)" strokeWidth={2} dot={false} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-center text-[10px] text-muted">Clic en una barra para filtrar el dashboard por mes</p>
      </CardContent>
    </Card>
  );
}
