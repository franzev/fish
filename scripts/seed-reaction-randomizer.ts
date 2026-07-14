export type SeedReactionMessage = {
  id: string;
  conversation_id?: string;
  created_at: string;
  deleted_at?: string | null;
  body?: string;
};

export type SeedReactionRow = {
  conversation_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  removed_at: null;
};

type BuildSeedReactionRowsOptions = {
  conversationId: string;
  messages: SeedReactionMessage[];
  users: string[];
  seed?: string;
  emojis?: string[];
  maxReactionsPerMessage?: number;
};

type BuildCommunitySeedTimelineOptions = {
  channelCount: number;
  messagesPerChannel: number;
  now?: number;
};

export type CommunitySeedChannelTimeline = {
  firstMessageAt: number;
  lastMessageAt: number;
};

const channelSpacingMs = 7 * 24 * 60 * 60 * 1000;
const messageSpacingMs = 45 * 60 * 1000;
const recentActivityBufferMs = 60 * 60 * 1000;

export function buildCommunitySeedTimeline({
  channelCount,
  messagesPerChannel,
  now = Date.now(),
}: BuildCommunitySeedTimelineOptions): CommunitySeedChannelTimeline[] {
  if (channelCount <= 0 || messagesPerChannel <= 0) return [];

  const lastMessageOffset = (messagesPerChannel - 1) * messageSpacingMs;
  const firstChannelStart = now
    - recentActivityBufferMs
    - (channelCount - 1) * channelSpacingMs
    - lastMessageOffset;

  return Array.from({ length: channelCount }, (_, channelIndex) => {
    const firstMessageAt = firstChannelStart + channelIndex * channelSpacingMs;
    return {
      firstMessageAt,
      lastMessageAt: firstMessageAt + lastMessageOffset,
    };
  });
}

const defaultReactionEmojis = [
  "👍",
  "❤️",
  "🎉",
  "🙏",
  "👏",
  "💡",
  "✅",
  "🙌",
  "🙂",
  "💪",
  "🌟",
  "👀",
  "🔥",
  "🤝",
  "✨",
  "🫶",
  "🚀",
  "💯",
  "🥳",
  "😊",
  "🤩",
  "💙",
  "💚",
  "💜",
  "🧡",
  "🤗",
  "👌",
  "✌️",
  "🤞",
  "🧠",
  "📚",
  "🏆",
];

export function buildSeedReactionRows({
  conversationId,
  messages,
  users,
  seed = "fish-seed-reactions",
  emojis = defaultReactionEmojis,
  maxReactionsPerMessage = 18,
}: BuildSeedReactionRowsOptions): SeedReactionRow[] {
  if (users.length === 0 || emojis.length === 0) {
    return [];
  }

  const maxCount = Math.max(1, Math.min(maxReactionsPerMessage, users.length));
  const rows: SeedReactionRow[] = [];

  for (const message of messages) {
    if (message.deleted_at) continue;

    const messageSeed = `${seed}:${message.id}`;
    const baseCreatedAt = new Date(message.created_at).getTime();

    if ((message.body?.length ?? 0) >= 1000) {
      const emojiTypeCount = Math.min(
        emojis.length,
        20 + Math.floor(randomFor(messageSeed, "super-long-emoji-types") * 11),
      );
      const selectedEmojis = selectEmojis(emojis, messageSeed, emojiTypeCount);
      let reactionIndex = 0;

      for (const emoji of selectedEmojis) {
        const count = Math.min(
          users.length,
          9 + Math.floor(randomFor(messageSeed, `super-long-count:${emoji}`) * 12),
        );
        const selectedUsers = selectUsers(users, `${messageSeed}:${emoji}`, count);

        for (const userId of selectedUsers) {
          reactionIndex += 1;
          rows.push({
            conversation_id: conversationId,
            message_id: message.id,
            user_id: userId,
            emoji,
            created_at: new Date(baseCreatedAt + reactionIndex * 1000).toISOString(),
            removed_at: null,
          });
        }
      }

      continue;
    }

    const reactionCount = Math.min(reactionCountFor(messageSeed), maxCount);
    if (reactionCount === 0) continue;

    const selectedEmojis = selectEmojis(emojis, messageSeed, emojiTypeCountFor(reactionCount, messageSeed));
    const selectedUsers = selectUsers(users, messageSeed, reactionCount);

    for (let index = 0; index < reactionCount; index += 1) {
      rows.push({
        conversation_id: conversationId,
        message_id: message.id,
        user_id: selectedUsers[index],
        emoji: selectedEmojis[index % selectedEmojis.length],
        created_at: new Date(baseCreatedAt + (index + 1) * 45 * 1000).toISOString(),
        removed_at: null,
      });
    }
  }

  return rows;
}

function reactionCountFor(seed: string): number {
  const roll = randomFor(seed, "volume");

  if (roll < 0.44) return 0;
  if (roll < 0.78) return 1;
  if (roll < 0.92) return 2;
  if (roll < 0.975) return 3 + Math.floor(randomFor(seed, "small-burst") * 3);
  if (roll < 0.995) return 6 + Math.floor(randomFor(seed, "medium-burst") * 5);
  return 11 + Math.floor(randomFor(seed, "large-burst") * 8);
}

function emojiTypeCountFor(reactionCount: number, seed: string): number {
  if (reactionCount <= 1) return 1;
  if (reactionCount <= 3) return 1 + Math.floor(randomFor(seed, "emoji-types") * 2);
  if (reactionCount <= 8) return 2 + Math.floor(randomFor(seed, "emoji-types") * 3);
  return 3 + Math.floor(randomFor(seed, "emoji-types") * 4);
}

function selectEmojis(emojis: string[], seed: string, count: number): string[] {
  const available = [...emojis];
  const selected: string[] = [];

  for (let index = 0; index < count && available.length > 0; index += 1) {
    const selectedIndex = Math.floor(randomFor(seed, `emoji-${index}`) * available.length);
    selected.push(available.splice(selectedIndex, 1)[0]);
  }

  return selected;
}

function selectUsers(users: string[], seed: string, count: number): string[] {
  const start = Math.floor(randomFor(seed, "user-start") * users.length);
  const stride = coprimeStride(users.length, seed);
  const selected: string[] = [];

  for (let index = 0; index < count; index += 1) {
    selected.push(users[(start + index * stride) % users.length]);
  }

  return selected;
}

function coprimeStride(length: number, seed: string): number {
  if (length <= 1) return 1;

  let stride = 1 + Math.floor(randomFor(seed, "user-stride") * (length - 1));
  while (greatestCommonDivisor(stride, length) !== 1) {
    stride = (stride % (length - 1)) + 1;
  }

  return stride;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;

  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a;
}

function randomFor(...parts: string[]): number {
  return mulberry32(hashString(parts.join(":")));
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): number {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
