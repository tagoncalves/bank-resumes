import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { FilterPill } from "../components/filter-pill";

function FilterPillRow() {
  const [active, setActive] = useState("month");
  return (
    <div className="flex flex-wrap gap-2 bg-background p-6">
      <FilterPill tone="primary" active={active === "month"} onClick={() => setActive("month")}>Este mes</FilterPill>
      <FilterPill tone="primary" active={active === "quarter"} onClick={() => setActive("quarter")}>Último trimestre</FilterPill>
      <FilterPill tone="primary" active={active === "year"} onClick={() => setActive("year")}>Último año</FilterPill>
      <FilterPill tone="neutral" active={active === "all"} onClick={() => setActive("all")}>Todo</FilterPill>
    </div>
  );
}

const meta = {
  title: "UI/FilterPill",
  component: FilterPill,
  args: {
    children: "Este mes",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["primary", "income", "neutral"],
    },
    active: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof FilterPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Active: Story = {
  args: {
    active: true,
  },
};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 bg-background p-6">
      <FilterPill tone="primary" active>Primary</FilterPill>
      <FilterPill tone="primary">Primary (off)</FilterPill>
      <FilterPill tone="income" active>Income</FilterPill>
      <FilterPill tone="income">Income (off)</FilterPill>
      <FilterPill tone="neutral" active>Neutral</FilterPill>
      <FilterPill tone="neutral">Neutral (off)</FilterPill>
      <FilterPill disabled>Disabled</FilterPill>
    </div>
  ),
};

export const UsageRow: Story = {
  render: () => <FilterPillRow />,
};
