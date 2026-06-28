import type { Meta, StoryObj } from "@storybook/nextjs";
import { Skeleton } from "../components/skeleton";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  argTypes: {
    className: { control: "text" },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: "h-4 w-64",
  },
};

export const Card: Story = {
  render: () => (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 max-w-sm">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  ),
};

export const TableRow: Story = {
  render: () => (
    <div className="flex flex-col gap-3 bg-background p-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-18" />
        <Skeleton className="h-3 w-22" />
      </div>
    </div>
  ),
};

export const CircleAndText: Story = {
  render: () => (
    <div className="flex items-center gap-4 bg-background p-6 max-w-sm">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex flex-col gap-2 flex-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  ),
};
