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
  commissions: "var(--color-primary)",
  selloTax: "var(--color-warning)",
  ivaTax: "var(--color-project)",
  iibbTax: "var(--color-other)",
  financingInterest: "var(--color-expense)",
};

export default function FeeBreakdown({ data }: { data: FeeData }) {
  const chartData = Object.entries(LABELS).map(([key, label]) => ({
    key,
    label,
    value: data[key as keyof FeeData] as number,
    color: COLORS[key],
  })).filter((d) => d.value > 0);

  return (
    <Card className="responsive-card overflow-hidden">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-foreground">
          Comisiones e impuestos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!chartData.length ? (
          <p className="py-8 text-center text-sm text-muted">Sin datos</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} width={100} />
                <Tooltip
                  formatter={(value) => [formatARS(Number(value)), ""]}
                  contentStyle={{ fontSize: 12, borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" }}
                />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex min-w-0 justify-between gap-3 border-t pt-2">
              <span className="min-w-0 text-xs text-muted">Total cargos adicionales</span>
              <span className="fluid-money-small min-w-0 text-right font-mono font-semibold text-expense">
                {formatARS(data.total)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
