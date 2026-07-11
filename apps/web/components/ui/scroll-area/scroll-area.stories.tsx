import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScrollArea } from "./scroll-area";

const items = Array.from(
  { length: 12 },
  (_, index) => `Conversation item ${index + 1}`
);

const meta = {
  title: "UI/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  args: {
    children: (
      <div className="flex flex-col gap-sm">
        {items.map((item) => (
          <div className="rounded-control bg-surface-2 p-md text-body" key={item}>
            {item}
          </div>
        ))}
      </div>
    ),
    className: "h-chat-demo max-w-content rounded-card bg-surface",
    viewportClassName: "p-md",
  },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OverflowingContent: Story = {};
