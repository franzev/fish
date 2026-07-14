import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { AvatarCommandService } from "@/lib/services";
import { AvatarPhotoEditor } from "./avatar-photo-editor";

const commands: AvatarCommandService = {
  initialize: async () => ({
    uploadId: "upload-1",
    bucket: "avatars",
    objectPath: "user-1/upload-1/staging.webp",
    uploadToken: "token",
    signedUploadUrl: "https://storage.test/upload",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }),
  complete: async () => ({
    profileId: "user-1",
    updatedAt: new Date().toISOString(),
  }),
  cancel: async () => undefined,
  remove: async () => undefined,
  resolveUrls: async () => [],
};

const meta = {
  title: "Profile/Avatar photo editor",
  component: AvatarPhotoEditor,
  args: {
    enabled: true,
    userId: "user-1",
    displayName: "Franz",
    currentAvatarUrl: null,
    hasAvatar: false,
    commands,
  },
} satisfies Meta<typeof AvatarPhotoEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const ExistingAvatar: Story = {
  args: { hasAvatar: true },
};

export const TemporarilyUnavailable: Story = {
  args: { enabled: false },
};
