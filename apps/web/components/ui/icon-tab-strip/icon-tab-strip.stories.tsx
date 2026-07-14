import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tabs } from "@base-ui/react/tabs";
import {
  IconBallBasketball,
  IconHeart,
  IconLayoutGrid,
  IconMoodSmile,
  IconPaw,
  IconPencil,
  IconSparkles,
} from "@tabler/icons-react";
import { useState, type ComponentProps } from "react";
import { IconTabStrip } from "./icon-tab-strip";

const stickerItems = [
  { value: "all", label: "All", Icon: IconLayoutGrid },
  { value: "cute", label: "Cute", Icon: IconHeart },
  { value: "hand-drawn", label: "Hand-drawn", Icon: IconPencil },
  { value: "expressive", label: "Expressive", Icon: IconSparkles },
] as const;

const emojiItems = [
  { value: "smileys", label: "Smileys & Emotion", Icon: IconMoodSmile },
  { value: "animals", label: "Animals & Nature", Icon: IconPaw },
  { value: "activities", label: "Activities", Icon: IconBallBasketball },
] as const;

const meta = {
  title: "UI/Icon tab strip",
  component: IconTabStrip,
  tags: ["autodocs"],
  args: {
    ariaLabel: "Emoji category",
    items: emojiItems,
    selectionMode: "tabs",
  },
  argTypes: {
    items: { control: false },
  },
  render: (args) => <IconTabStripPreview {...args} />,
} satisfies Meta<typeof IconTabStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StickerStyles: Story = {
  args: {
    ariaLabel: "Sticker style",
    items: stickerItems,
    selectionMode: "filter",
    value: "all",
    onValueChange: () => undefined,
  },
};

export const EmojiCategories: Story = {};

function IconTabStripPreview(args: ComponentProps<typeof IconTabStrip>) {
  const [value, setValue] = useState(args.value ?? args.items[0]?.value);

  return (
    <div className="w-emoji-panel overflow-hidden rounded-card bg-surface">
      <Tabs.Root defaultValue={args.items[0]?.value}>
        <div className="min-h-control bg-surface-2" />
        {args.selectionMode === "filter" ? (
          <IconTabStrip
            {...args}
            value={value ?? ""}
            onValueChange={setValue}
          />
        ) : (
          <IconTabStrip {...args} />
        )}
      </Tabs.Root>
    </div>
  );
}
