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
        <CardTitle className="text-sm font-medium text-foreground">Top comercios</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <p className="py-8 text-center text-sm text-muted">Sin datos</p>
        ) : (
          <div className="space-y-2">
            {data.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 text-right text-xs font-medium text-muted">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{m.merchantName}</p>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: m.categoryColor }}
                    />
                    <span className="text-xs text-muted">{m.categoryName} · {m.transactionCount} op.</span>
                  </div>
                </div>
                <span className="font-mono text-sm font-medium tabular-nums text-foreground">
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
