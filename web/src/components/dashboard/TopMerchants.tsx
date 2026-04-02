import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatARS } from "@/lib/formatters";

interface Merchant {
  merchantName: string;
  total: number;
  transactionCount: number;
  categoryName: string;
  categoryColor: string;
}

export default function TopMerchants({ data }: { data: Merchant[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-700">Top comercios</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <p className="py-8 text-center text-sm text-zinc-400">Sin datos</p>
        ) : (
          <div className="space-y-2">
            {data.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 text-right text-xs font-medium text-zinc-400">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800">{m.merchantName}</p>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: m.categoryColor }}
                    />
                    <span className="text-xs text-zinc-400">{m.categoryName} · {m.transactionCount} op.</span>
                  </div>
                </div>
                <span className="font-mono text-sm font-medium text-zinc-700 tabular-nums">
                  {formatARS(m.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
