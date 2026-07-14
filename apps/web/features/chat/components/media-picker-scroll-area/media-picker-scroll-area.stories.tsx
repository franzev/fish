import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MediaPickerScrollArea } from "./media-picker-scroll-area";

const meta = {
  title: "Chat/MediaPickerScrollArea",
  component: MediaPickerScrollArea,
  parameters: { layout: "centered" },
  args: {
    className: "h-gif-panel-h w-gif-panel bg-surface",
    children: null,
  },
} satisfies Meta<typeof MediaPickerScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overflowing: Story = {
  args: {
    children: (
      <div className="grid gap-xs">
        {Array.from({ length: 18 }, (_, index) => (
          <div key={index} className="rounded-control bg-surface-2 p-sm text-ui-sm text-body">
            Expressive media result {index + 1}
          </div>
        ))}
      </div>
    ),
  },
};

export const ShortContent: Story = {
  args: {
    children: <p className="rounded-control bg-surface-2 p-sm text-ui-sm text-body">One result</p>,
  },
};
