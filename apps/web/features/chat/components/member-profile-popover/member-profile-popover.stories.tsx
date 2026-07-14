import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within } from "storybook/test";
import type {
  ClientFriendRequest,
  FriendCandidate,
  FriendCommandService,
  FriendRepository,
} from "@/lib/services";
import {
  MemberProfilePopover,
  type CommunityMemberProfile,
} from "./member-profile-popover";

const viewer: CommunityMemberProfile = {
  id: "client-franz",
  displayName: "Franz Eva",
  username: "franz_eva",
  role: "client",
};

const member: CommunityMemberProfile = {
  id: "client-sam",
  displayName: "Sam Okafor",
  username: "sam_okafor",
  role: "client",
};

const request: ClientFriendRequest = {
  id: "request-1",
  senderId: viewer.id,
  recipientId: member.id,
  status: "pending",
  createdAt: "2026-07-14T01:00:00.000Z",
  updatedAt: "2026-07-14T01:00:00.000Z",
  respondedAt: null,
};

function candidate(status: FriendCandidate["status"]): FriendCandidate {
  return {
    status,
    requestId: status === "incomingPending" ? "request-9" : null,
    profile: status === "unavailable"
      ? null
      : {
          id: member.id,
          displayName: member.displayName,
          username: member.username ?? "sam_okafor",
        },
  };
}

function repository(status: FriendCandidate["status"]): FriendRepository {
  return {
    searchCandidate: async () => ({ ok: true, data: candidate(status) }),
  } as unknown as FriendRepository;
}

const pendingRepository = {
  searchCandidate: async () => new Promise(() => undefined),
} as unknown as FriendRepository;

const failingRepository = {
  searchCandidate: async () => { throw new Error("offline"); },
} as unknown as FriendRepository;

const commands = {
  sendRequest: async () => ({ ok: true as const, data: request }),
  blockUser: async () => ({ ok: true as const, data: undefined }),
} as unknown as FriendCommandService;

const meta = {
  title: "Chat/MemberProfilePopover",
  component: MemberProfilePopover,
  tags: ["autodocs"],
  args: {
    member,
    currentUserId: viewer.id,
    currentUserRole: viewer.role,
    friendActionsEnabled: true,
    trigger: "name",
    repository: repository("none"),
    commands,
  },
  parameters: {
    controls: { exclude: ["repository", "commands"] },
    layout: "centered",
  },
} satisfies Meta<typeof MemberProfilePopover>;

export default meta;
type Story = StoryObj<typeof meta>;

async function openProfile(canvasElement: HTMLElement, displayName: string) {
  const canvas = within(canvasElement);
  await canvas.getByRole("button", { name: `View ${displayName} profile` }).click();
}

export const Client: Story = {
  play: async ({ canvasElement }) => openProfile(canvasElement, member.displayName),
};

export const Coach: Story = {
  args: {
    member: {
      id: "gwyn",
      displayName: "Gwyn",
      username: "gwyn",
      role: "coach",
    },
  },
  play: async ({ canvasElement, args }) =>
    openProfile(canvasElement, args.member.displayName),
};

export const OwnProfile: Story = {
  args: { member: viewer },
  play: async ({ canvasElement }) => openProfile(canvasElement, viewer.displayName),
};

export const RequestSent: Story = {
  args: { repository: repository("outgoingPending") },
  play: async ({ canvasElement }) => openProfile(canvasElement, member.displayName),
};

export const IncomingRequest: Story = {
  args: { repository: repository("incomingPending") },
  play: async ({ canvasElement }) => openProfile(canvasElement, member.displayName),
};

export const LoadingRelationship: Story = {
  args: { repository: pendingRepository },
  play: async ({ canvasElement }) => openProfile(canvasElement, member.displayName),
};

export const RelationshipError: Story = {
  args: { repository: failingRepository },
  play: async ({ canvasElement }) => openProfile(canvasElement, member.displayName),
};

export const FriendActionsDisabled: Story = {
  args: { friendActionsEnabled: false },
  play: async ({ canvasElement }) => openProfile(canvasElement, member.displayName),
};

export const Friend: Story = {
  args: { repository: repository("friends") },
  play: async ({ canvasElement }) => openProfile(canvasElement, member.displayName),
};

export const LongNameWithoutUsername: Story = {
  args: {
    member: {
      ...member,
      displayName: "Alexandria Marie Santos-Rivera",
      username: null,
    },
  },
  play: async ({ canvasElement, args }) =>
    openProfile(canvasElement, args.member.displayName),
};

export const Blocked: Story = {
  args: { repository: repository("friends") },
  play: async ({ canvasElement }) => {
    await openProfile(canvasElement, member.displayName);
    const body = within(canvasElement.ownerDocument.body);
    await body.getByRole("button", { name: `More actions for ${member.displayName}` }).click();
    await body.getByRole("menuitem", { name: "Block member" }).click();
    await body.getByRole("button", { name: /^Block$/ }).click();
  },
};

export const SendRequestError: Story = {
  args: {
    commands: {
      ...commands,
      sendRequest: async () => { throw new Error("offline"); },
    } as unknown as FriendCommandService,
  },
  play: async ({ canvasElement }) => {
    await openProfile(canvasElement, member.displayName);
    const body = within(canvasElement.ownerDocument.body);
    await body.findByRole("button", { name: "Add friend" });
    await body.getByRole("button", { name: "Add friend" }).click();
  },
};

export const BlockError: Story = {
  args: {
    repository: repository("friends"),
    commands: {
      ...commands,
      blockUser: async () => { throw new Error("offline"); },
    } as unknown as FriendCommandService,
  },
  play: async ({ canvasElement }) => {
    await openProfile(canvasElement, member.displayName);
    const body = within(canvasElement.ownerDocument.body);
    await body.getByRole("button", { name: `More actions for ${member.displayName}` }).click();
    await body.getByRole("menuitem", { name: "Block member" }).click();
    await body.getByRole("button", { name: /^Block$/ }).click();
  },
};
