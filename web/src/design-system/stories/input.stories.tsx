import type { Meta, StoryObj } from "@storybook/nextjs";
import { Input } from "../components/input";

const meta = {
  title: "UI/Input",
  component: Input,
  args: {
    placeholder: "Ingresá un valor...",
  },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "number", "password", "tel", "url", "date"],
    },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: {
    defaultValue: "Supermercado",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "No editable",
  },
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4 bg-background p-6 max-w-sm">
      <Input placeholder="Estado normal" />
      <Input placeholder="Con foco por defecto" autoFocus />
      <Input placeholder="Campo deshabilitado" disabled />
      <Input placeholder="Solo lectura" readOnly value="Valor fijo" />
      <Input placeholder="Tipo número" type="number" />
      <Input placeholder="Tipo fecha" type="date" />
    </div>
  ),
};
