import type { Meta, StoryObj } from "@storybook/nextjs";
import { Bot } from "lucide-react";
import { Button } from "../components/button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Button",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "destructive", "ai"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "icon"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 bg-background p-6">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Expense</Button>
      <Button variant="ai"><Bot className="h-4 w-4" /> AI</Button>
    </div>
  ),
};
