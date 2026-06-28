import type { Meta, StoryObj } from "@storybook/nextjs";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/table";
import { Badge } from "../components/badge";

const meta = {
  title: "UI/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="bg-background p-6">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Comercio</TableHeaderCell>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Monto</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
          </TableRow>
        </TableHead>
        <tbody>
          <TableRow>
            <TableCell className="font-medium">Mercado Libre</TableCell>
            <TableCell className="text-muted">15/06/2026</TableCell>
            <TableCell>$42.500</TableCell>
            <TableCell><Badge variant="expense">Gasto</Badge></TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Disney+</TableCell>
            <TableCell className="text-muted">14/06/2026</TableCell>
            <TableCell>$5.899</TableCell>
            <TableCell><Badge variant="expense">Gasto</Badge></TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Sueldo</TableCell>
            <TableCell className="text-muted">01/06/2026</TableCell>
            <TableCell>$824.300</TableCell>
            <TableCell><Badge variant="income">Ingreso</Badge></TableCell>
          </TableRow>
        </tbody>
      </Table>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="bg-background p-6">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Comercio</TableHeaderCell>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Monto</TableHeaderCell>
          </TableRow>
        </TableHead>
        <tbody>
          <TableRow>
            <TableCell colSpan={3} className="py-8 text-center text-muted">
              No hay movimientos
            </TableCell>
          </TableRow>
        </tbody>
      </Table>
    </div>
  ),
};

export const Dense: Story = {
  render: () => (
    <div className="bg-background p-6 max-w-md">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Resumen</TableHeaderCell>
            <TableHeaderCell>Valor</TableHeaderCell>
          </TableRow>
        </TableHead>
        <tbody>
          <TableRow>
            <TableCell>Saldo anterior</TableCell>
            <TableCell className="font-mono">$180.000</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Consumo total</TableCell>
            <TableCell className="font-mono">$624.800</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Pagos aplicados</TableCell>
            <TableCell className="font-mono">-$210.000</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Saldo actual</TableCell>
            <TableCell className="font-mono font-semibold">$594.800</TableCell>
          </TableRow>
        </tbody>
      </Table>
    </div>
  ),
};
