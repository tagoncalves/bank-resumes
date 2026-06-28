import type { Meta, StoryObj } from "@storybook/nextjs";
import { Textarea } from "../components/textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  args: {
    placeholder: "Escribí un comentario...",
    rows: 4,
  },
  argTypes: {
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    rows: { control: { type: "number", min: 2, max: 12 } },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: {
    defaultValue: "Nota del pago registrado el 15/06/2026.",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "Campo deshabilitado",
  },
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4 bg-background p-6 max-w-sm">
      <Textarea placeholder="Estado normal" />
      <Textarea placeholder="Con contenido" defaultValue="Pago mínimo BBVA julio 2026" />
      <Textarea placeholder="Campo deshabilitado" disabled />
      <Textarea placeholder="Rows personalizados" rows={3} />
    </div>
  ),
};
