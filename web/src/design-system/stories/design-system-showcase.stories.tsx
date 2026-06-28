import type { Meta, StoryObj } from "@storybook/nextjs";
import { DesignSystemShowcase } from "./design-system-showcase";

const meta = {
  title: "Design System/Warm Finance Playground",
  component: DesignSystemShowcase,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof DesignSystemShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
