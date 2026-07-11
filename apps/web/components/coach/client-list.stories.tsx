import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ClientList } from "@/features/coach";

const meta = {
  title: "Product/ClientList",
  component: ClientList,
  tags: ["autodocs"],
  args: {
    clients: [
      {
        id: "client-2",
        displayName: "Mina Reyes",
        email: "mina@example.com",
      },
      {
        id: "client-1",
        displayName: "Alex Chen",
        email: "alex@example.com",
      },
      {
        id: "client-3",
        displayName: "Sam Patel",
        email: "sam@example.com",
      },
    ],
  },
} satisfies Meta<typeof ClientList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithClients: Story = {};

export const SingleClient: Story = {
  args: {
    clients: [
      {
        id: "client-1",
        displayName: "Alex Chen",
        email: "alex@example.com",
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    clients: [],
  },
};
