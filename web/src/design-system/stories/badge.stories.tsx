import type { Meta, StoryObj } from "@storybook/nextjs";
import { Badge } from "../components/badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  args: {
    children: "Badge",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "destructive", "income", "expense", "saving", "project", "warning", "ai"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Semantic: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 bg-background p-6">
      <Badge>Balance</Badge>
      <Badge variant="income">Ingresos</Badge>
      <Badge variant="expense">Egresos</Badge>
      <Badge variant="saving">Ahorros</Badge>
      <Badge variant="project">Proyectos</Badge>
      <Badge variant="warning">Alertas</Badge>
      <Badge variant="ai">AI / Chat</Badge>
    </div>
  ),
};
