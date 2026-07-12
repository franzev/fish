import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ClientChatGif } from "@/lib/services";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import { GifPicker } from "./gif-picker";

const ids = [
  "JIX9t2j0ZTN9S",
  "3oriO0OEd9QIDdllqo",
  "mlvseq9yvZhba",
  "vFKqnCdLPNOKc",
  "13CoXDiaCcCoyk",
  "5i7umUqAOYYEw",
];

const gifs: ClientChatGif[] = ids.map((id, index) => ({
  provider: "klipy",
  providerId: id,
  title: `Reaction GIF ${index + 1}`,
  description: [
    "A cat typing quickly",
    "A cat looking surprised",
    "A person dancing happily",
    "A cat nodding",
    "A person celebrating",
    "A cat giving a serious look",
  ][index] ?? "Animated reaction",
  sourceUrl: `https://giphy.com/gifs/${id}`,
  posterUrl: `https://media.giphy.com/media/${id}/200_s.gif`,
  previewUrl: `https://media.giphy.com/media/${id}/200w.mp4`,
  mediaUrl: `https://media.giphy.com/media/${id}/giphy.mp4`,
  width: index % 2 === 0 ? 480 : 360,
  height: index % 2 === 0 ? 270 : 360,
}));

const storyProvider: GifProvider = {
  name: "KLIPY",
  available: true,
  trending: async () => ({ gifs, next: null }),
  search: async () => ({ gifs: gifs.slice().reverse(), next: null }),
  registerShare: async () => undefined,
};

const meta = {
  title: "Chat/GifPicker",
  component: GifPicker,
  parameters: { layout: "centered" },
  args: {
    onSelect: () => undefined,
    provider: storyProvider,
  },
} satisfies Meta<typeof GifPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Trending: Story = {};
