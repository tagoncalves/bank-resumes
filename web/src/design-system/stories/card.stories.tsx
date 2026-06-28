import type { Meta, StoryObj } from "@storybook/nextjs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/card";
import { Badge } from "../components/badge";
import { Button } from "../components/button";

const meta = {
  title: "UI/Card",
  component: Card,
  args: {
    className: "max-w-sm",
  },
  argTypes: {
    className: { control: "text" },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Balance del mes</CardTitle>
        <CardDescription>Resumen de ingresos y egresos del período actual.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight text-foreground">$432.120</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Resumen BBVA</CardTitle>
        <CardDescription>•••• 4523 · Julio 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Consumo</span>
            <span className="font-medium text-foreground">$214.500</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Pago mínimo</span>
            <span className="font-medium text-foreground">$28.400</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Ver detalle</Button>
        <Button variant="outline" size="sm">Pagar</Button>
      </CardFooter>
    </Card>
  ),
};

export const SemanticGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 bg-background p-6 max-w-lg">
      <Card>
        <CardContent className="p-5">
          <Badge variant="income">Ingresos</Badge>
          <p className="mt-4 text-2xl font-semibold text-foreground">+$824.300</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <Badge variant="expense">Egresos</Badge>
          <p className="mt-4 text-2xl font-semibold text-foreground">-$392.180</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <Badge variant="saving">Ahorros</Badge>
          <p className="mt-4 text-2xl font-semibold text-foreground">$131.900</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <Badge variant="project">Proyectos</Badge>
          <p className="mt-4 text-2xl font-semibold text-foreground">$67.200</p>
        </CardContent>
      </Card>
    </div>
  ),
};
