import { describe, expect, it } from "vitest";
import { buildSeedReactionRows } from "../../../scripts/seed-reaction-randomizer";

const conversationId = "11111111-1111-4111-8111-111111111111";

const messages = Array.from({ length: 900 }, (_, index) => {
  const messageNumber = index + 1;
  const createdAt = new Date(Date.UTC(2026, 4, 18, 8, messageNumber)).toISOString();

  return {
    id: `00000000-0000-4000-8000-${String(messageNumber).padStart(12, "0")}`,
    conversation_id: conversationId,
    created_at: createdAt,
    deleted_at: messageNumber % 113 === 0 ? createdAt : null,
  };
});

const users = Array.from({ length: 128 }, (_, index) => `user-${String(index + 1).padStart(3, "0")}`);

describe("buildSeedReactionRows", () => {
  it("creates deterministic, varied reactions spread naturally across many messages", () => {
    const first = buildSeedReactionRows({
      conversationId,
      messages,
      users,
      seed: "fish-general-reactions",
    });
    const second = buildSeedReactionRows({
      conversationId,
      messages,
      users,
      seed: "fish-general-reactions",
    });

    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(600);
    expect(first.length).toBeLessThan(1800);

    const countsByMessage = new Map<string, number>();
    const emojiTypes = new Set<string>();
    for (const reaction of first) {
      countsByMessage.set(reaction.message_id, (countsByMessage.get(reaction.message_id) ?? 0) + 1);
      emojiTypes.add(reaction.emoji);
      expect(reaction.conversation_id).toBe(conversationId);
      expect(reaction.removed_at).toBeNull();
    }

    const reactedMessageCount = countsByMessage.size;
    const maxReactionCount = Math.max(...countsByMessage.values());
    const singleReactionMessages = Array.from(countsByMessage.values()).filter((count) => count === 1).length;
    const deletedMessageIds = new Set(messages.filter((message) => message.deleted_at).map((message) => message.id));

    expect(reactedMessageCount).toBeGreaterThan(250);
    expect(maxReactionCount).toBeLessThanOrEqual(18);
    expect(singleReactionMessages).toBeGreaterThan(100);
    expect(emojiTypes.size).toBeGreaterThanOrEqual(10);
    expect(Array.from(countsByMessage.keys()).some((messageId) => deletedMessageIds.has(messageId))).toBe(false);
  });

  it("leaves a deterministic subset of visible messages without reactions", () => {
    const reactions = buildSeedReactionRows({
      conversationId,
      messages,
      users,
      seed: "fish-general-reactions",
    });

    const reactedMessageIds = new Set(reactions.map((reaction) => reaction.message_id));
    const visibleMessages = messages.filter((message) => !message.deleted_at);

    expect(visibleMessages).toHaveLength(893);
    const messagesWithoutReactions = visibleMessages.filter(
      (message) => !reactedMessageIds.has(message.id),
    );

    expect(messagesWithoutReactions.length).toBeGreaterThan(250);
    expect(messagesWithoutReactions.length).toBeLessThan(500);
  });

  it("gives super-long messages 20-30 reaction types with 9-20 reactions each", () => {
    const message = {
      id: "super-long-message",
      conversation_id: conversationId,
      created_at: new Date(Date.UTC(2026, 4, 18, 8)).toISOString(),
      deleted_at: null,
      body: "x".repeat(1000),
    };

    const reactions = buildSeedReactionRows({
      conversationId,
      messages: [message],
      users,
      seed: "fish-general-reactions",
    });
    const countsByEmoji = new Map<string, number>();

    for (const reaction of reactions) {
      countsByEmoji.set(reaction.emoji, (countsByEmoji.get(reaction.emoji) ?? 0) + 1);
    }

    expect(countsByEmoji.size).toBeGreaterThanOrEqual(20);
    expect(countsByEmoji.size).toBeLessThanOrEqual(30);
    expect(Array.from(countsByEmoji.values()).every((count) => count >= 9 && count <= 20)).toBe(true);
    expect(new Set(countsByEmoji.values()).size).toBeGreaterThanOrEqual(3);
  });
});
