import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import { MessageActions } from "./message-actions";

const meta = {
  title: "Chat/MessageActions",
  component: MessageActions,
  decorators: [
    (Story) => (
      <div className="group relative min-h-card w-notifications rounded-card bg-surface-2 p-md">
        <p className="text-ui-sm text-body">A focused message with its available actions.</p>
        <Story />
      </div>
    ),
  ],
  args: {
    mine: false,
    layout: "direct",
    canEdit: false,
    canDelete: false,
    canReportGif: false,
    onReply: fn(),
    onReact: fn(),
    onEdit: fn(),
    onDelete: fn(async () => ({ ok: true })),
    onReportGif: fn(),
  },
} satisfies Meta<typeof MessageActions>;

export default meta;
type Story = StoryObj<typeof meta>;

async function revealActions(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.hover(canvas.getByText("A focused message with its available actions."));
  return canvas.getByRole("button", { name: "More actions for message" });
}

export const ReceivedMessage: Story = {};

export const OwnEditableMessage: Story = {
  args: { mine: true, canEdit: true, canDelete: true },
};

export const CommunityMessage: Story = {
  args: { layout: "community" },
};

export const ReportableGif: Story = {
  args: { canReportGif: true },
  play: async ({ canvasElement }) => {
    (await revealActions(canvasElement)).click();
  },
};

export const DeleteConfirmation: Story = {
  args: { mine: true, canEdit: true, canDelete: true },
  play: async ({ canvasElement }) => {
    (await revealActions(canvasElement)).click();
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("button", { name: "Delete message" }));
  },
};

export const DeleteError: Story = {
  args: {
    mine: true,
    canDelete: true,
    onDelete: fn(async () => ({ ok: false, notice: "That message is still here. Try again." })),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    (await revealActions(canvasElement)).click();
    await userEvent.click(await body.findByRole("button", { name: "Delete message" }));
    await userEvent.click(body.getByRole("button", { name: "Delete message" }));
  },
};
