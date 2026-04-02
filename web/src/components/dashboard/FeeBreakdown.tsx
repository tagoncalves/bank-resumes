"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatARS } from "@/lib/formatters";

interface FeeData {
  commissions: number;
  selloTax: number;
  ivaTax: number;
  iibbTax: number;
  financingInterest: number;
  total: number;
}

const LABELS: Record<string, string> = {
  commissions: "Comisiones",
  selloTax: "Impuesto sello",
  ivaTax: "IVA",
  iibbTax: "IIBB",
  financingInterest: "Intereses financ.",
};

const COLORS: Record<string, string> = {
  commissions: "#6366f1",
  selloTax: "#f59e0b",
  ivaTax: "#ec4899",
  iibbTax: "#f97316",
  financingInterest: "#ef4444",
};

export default function FeeBreakdown({ data }: { data: FeeData }) {
  const chartData = Object.entries(LABELS).map(([key, label]) => ({
    key,
    label,
    value: data[key as keyof FeeData] as number,
    color: COLORS[key],
  })).filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-700">
          Comisiones e impuestos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!chartData.length ? (
          <p className="py-8 text-center text-sm text-zinc-400">Sin datos</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={100} />
                <Tooltip
                  formatter={(value) => [formatARS(Number(value)), ""]}
                  contentStyle={{ fontSize: 12, borderColor: "#e4e4e7" }}
                />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex justify-between border-t pt-2">
              <span className="text-xs text-zinc-500">Total cargos adicionales</span>
              <span className="font-mono text-sm font-semibold text-red-600">
                {formatARS(data.total)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
