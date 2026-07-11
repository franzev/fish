import { Avatar } from "../../avatar";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CommunityMessageRowLayout } from "./community-message-row-layout";

const meta = {
  title: "Chat/CommunityMessageRowLayout",
  component: CommunityMessageRowLayout,
  tags: ["autodocs"],
  args: {
    avatarSlot: <Avatar name="Maya Santos" size="sm" />,
    startsGroup: true,
    hasPrecedingRow: false,
    interactive: true,
    children: (
      <>
        <strong className="text-ui-sm text-foreground">Maya Santos</strong>
        <span className="text-ui-sm text-body">Try the sentence once more.</span>
      </>
    ),
  },
} satisfies Meta<typeof CommunityMessageRowLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthorRow: Story = {};

export const Continuation: Story = {
  args: {
    avatarSlot: <div aria-hidden="true" className="size-8 shrink-0" />,
    startsGroup: false,
    hasPrecedingRow: true,
  },
};
