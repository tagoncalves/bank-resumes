import { ArrowUpRight, Bot, CreditCard, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/design-system/components/card";
import { cn } from "@/lib/utils";
import { warmFinanceTokens } from "@/design-system/tokens";

const semanticItems = [
  { label: "Ingresos", value: "+ $824.300", variant: "income", icon: TrendingUp },
  { label: "Egresos", value: "- $392.180", variant: "expense", icon: TrendingDown },
  { label: "Ahorros", value: "$131.900", variant: "saving", icon: PiggyBank },
  { label: "AI Coach", value: "3 planes", variant: "ai", icon: Bot },
] as const;

const semanticColors = {
  income: "var(--color-income)",
  expense: "var(--color-expense)",
  saving: "var(--color-saving)",
  ai: "var(--color-ai)",
} as const;

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
      <div className="h-16 rounded-[var(--radius-sm)] border border-black/5" style={{ backgroundColor: value }} />
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{name}</span>
        <code className="font-mono text-xs text-muted">{value}</code>
      </div>
    </div>
  );
}

function MiniBars() {
  const bars = [68, 86, 46, 58, 34, 62, 44, 28];

  return (
    <div className="flex h-36 items-end gap-2 rounded-[var(--radius-lg)] bg-surface-alt p-4">
      {bars.map((height, index) => (
        <div
          key={height + index}
          className="flex-1 rounded-t-full"
          style={{ height: `${height}%`, backgroundColor: warmFinanceTokens.chartSeries[index] }}
        />
      ))}
    </div>
  );
}

export function DesignSystemShowcase() {
  return (
    <main className="min-h-screen bg-background p-5 text-foreground sm:p-8">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden bg-[linear-gradient(135deg,var(--color-surface),color-mix(in_srgb,var(--color-primary)_18%,var(--color-surface-alt)))]">
            <CardHeader className="pb-3">
              <Badge className="w-fit" variant="outline">Warm Finance</Badge>
              <CardTitle className="max-w-2xl text-4xl leading-tight tracking-[-0.045em] sm:text-6xl">
                Finanzas claras, humanas y sin estética bancaria fría.
              </CardTitle>
              <CardDescription className="max-w-xl text-base">
                Neutros cálidos para respirar, verde petróleo para control financiero y acentos suaves para separar ingresos, egresos, ahorro, proyectos y AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 pt-2">
              <Button>Acción principal</Button>
              <Button variant="secondary">Planificar mes</Button>
              <Button variant="ai"><Bot className="h-4 w-4" /> Preguntar a AI</Button>
              <Button variant="outline">Ver dashboard</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Balance del mes</CardTitle>
              <CardDescription>Ejemplo de tarjeta financiera con números legibles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm text-muted">Saldo proyectado</p>
                <p className="text-4xl font-semibold tracking-[-0.04em]">$432.120</p>
              </div>
              <MiniBars />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Badge variant="income">Ingresos +24%</Badge>
                <Badge variant="expense">Egresos -8%</Badge>
                <Badge variant="saving">Ahorro 16%</Badge>
                <Badge variant="project">Proyecto auto</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {semanticItems.map(({ label, value, variant, icon: Icon }) => (
            <Card key={label} className="shadow-soft">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <Badge variant={variant}>{label}</Badge>
                  <p className="mt-4 text-2xl font-semibold tracking-[-0.035em]">{value}</p>
                  <p className="mt-1 text-sm text-muted">Token semántico dedicado</p>
                </div>
                <div className={cn("rounded-full p-2 text-white")} style={{ backgroundColor: semanticColors[variant] }}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tokens de color</CardTitle>
            <CardDescription>La identidad reserva el verde para balance, ingresos y acciones clave; el resto respira con neutros cálidos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(warmFinanceTokens.light).map(([name, value]) => (
              <Swatch key={name} name={`light.${name}`} value={value} />
            ))}
            {Object.entries(warmFinanceTokens.primary).map(([name, value]) => (
              <Swatch key={name} name={`primary.${name}`} value={value} />
            ))}
            {Object.entries(warmFinanceTokens.semantic).map(([name, value]) => (
              <Swatch key={name} name={`semantic.${name}`} value={value} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Componentes base</CardTitle>
            <CardDescription>Botones, badges, tarjetas y patrones para dashboards financieros.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Expense</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Balance</Badge>
                <Badge variant="income">Ingreso</Badge>
                <Badge variant="expense">Egreso</Badge>
                <Badge variant="saving">Ahorro</Badge>
                <Badge variant="project">Proyecto</Badge>
                <Badge variant="warning">Alerta</Badge>
                <Badge variant="ai">AI</Badge>
              </div>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-border bg-surface-alt p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted">Pago recomendado</p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">$86.400</p>
                </div>
                <CreditCard className="h-9 w-9 text-primary" />
              </div>
              <div className="mt-5 flex items-center justify-between rounded-[var(--radius-md)] bg-surface p-3 text-sm">
                <span className="text-muted">Evita intereses el 12/07</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  Revisar <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
