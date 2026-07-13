/** Seeded community channels. IDs must match scripts/seed.ts. */
export const generalChannelId = "22222222-2222-4222-8222-222222222222";
export const generalChannelSlug = "general";
export const generalChannelName = "general";
export const generalChannelHref = `/channels/${generalChannelSlug}`;

export interface CommunityChannel {
  id: string;
  slug: string;
  name: string;
  href: string;
}

export const communityChannels: CommunityChannel[] = [
  {
    id: generalChannelId,
    slug: generalChannelSlug,
    name: generalChannelName,
    href: generalChannelHref,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "introductions",
    name: "introduce yourself",
    href: "/channels/introductions",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    slug: "announcements",
    name: "announcements",
    href: "/channels/announcements",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    slug: "small-wins",
    name: "small wins",
    href: "/channels/small-wins",
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    slug: "how-do-i-say-this",
    name: "how do I say this?",
    href: "/channels/how-do-i-say-this",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    slug: "meeting-prep",
    name: "meeting prep",
    href: "/channels/meeting-prep",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    slug: "tone-check",
    name: "tone check",
    href: "/channels/tone-check",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    slug: "after-the-meeting",
    name: "after the meeting",
    href: "/channels/after-the-meeting",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    slug: "words-from-work",
    name: "words from work",
    href: "/channels/words-from-work",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    slug: "quiet-practice",
    name: "quiet practice",
    href: "/channels/quiet-practice",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    slug: "ask-a-coach",
    name: "ask a coach",
    href: "/channels/ask-a-coach",
  },
  {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    slug: "communication-repairs",
    name: "communication repairs",
    href: "/channels/communication-repairs",
  },
  {
    id: "12121212-1212-4212-8212-121212121212",
    slug: "returning-today",
    name: "returning today",
    href: "/channels/returning-today",
  },
  {
    id: "13131313-1313-4313-8313-131313131313",
    slug: "celebrate-someone",
    name: "celebrate someone",
    href: "/channels/celebrate-someone",
  },
  {
    id: "14141414-1414-4414-8414-141414141414",
    slug: "coworker-culture",
    name: "coworker culture",
    href: "/channels/coworker-culture",
  },
];

export function findCommunityChannel(value: string): CommunityChannel | undefined {
  return communityChannels.find(
    (channel) => channel.slug === value || channel.id === value,
  );
}
