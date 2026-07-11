import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fixtures from "../../../packages/core/src/chat-state/fixtures/chat-state-vectors.json";

type FixtureCase = {
  name: string;
  initialState: ChatStateLike;
  events: unknown[];
  expectedState?: ChatStateLike;
  expectedSelectors?: {
    unreadCount?: {
      conversationId: string;
      currentUserId: string;
      readStateUserId: string;
      expected: number;
    };
    outgoingStatus?: {
      conversationId: string;
      messageId: string;
      readStateUserId: string;
      expected: string;
    };
    snippet?: {
      conversationId: string;
      messageId: string;
      expected: string;
    };
    replyPreview?: {
      conversationId: string;
      messageId: string;
      currentUserId: string;
      participantName: string;
      currentUserName: string;
      expected: {
        id: string;
        authorName: string;
        snippet: string;
      };
    };
  };
};

type ChatStateLike = {
  conversations: Record<
    string,
    {
      messages: MessageLike[];
      readStates: ReadStateLike[];
    }
  >;
};

type MessageLike = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  deletedAt?: string | null;
};

type ReadStateLike = {
  userId: string;
  lastDeliveredMessageId: string | null;
  lastReadMessageId: string | null;
};

type ChatStateModule = {
  applyChatEvents: (state: ChatStateLike, events: unknown[]) => ChatStateLike;
  createEmptyChatState: () => ChatStateLike;
  countUnreadMessages: (
    messages: MessageLike[],
    currentUserId: string,
    currentUserReadState: ReadStateLike | null | undefined
  ) => number;
  getMessageSnippet: (message: MessageLike) => string;
  getOutgoingMessageStatus: (
    message: MessageLike,
    messages: MessageLike[],
    participantReadState: ReadStateLike | null | undefined
  ) => string;
  toReplyPreview: (
    message: MessageLike,
    currentUserId: string,
    participantName: string,
    currentUserName: string
  ) => {
    id: string;
    authorName: string;
    snippet: string;
  };
};

async function loadChatStateModule(): Promise<ChatStateModule> {
  const modulePath = "@fish/core/chat-state";
  return import(/* @vite-ignore */ modulePath) as Promise<ChatStateModule>;
}

function getConversation(state: ChatStateLike, id: string) {
  const conversation = state.conversations[id];
  expect(conversation).toBeDefined();
  return conversation;
}

function getMessage(
  state: ChatStateLike,
  conversationId: string,
  messageId: string
) {
  const conversation = getConversation(state, conversationId);
  const message = conversation.messages.find((item) => item.id === messageId);
  expect(message).toBeDefined();
  return message!;
}

function getReadState(
  state: ChatStateLike,
  conversationId: string,
  userId: string
) {
  const conversation = getConversation(state, conversationId);
  return conversation.readStates.find((item) => item.userId === userId) ?? null;
}

describe("chat-state fixture vectors", () => {
  it("exposes the portable reducer and selector surface", async () => {
    const {
      applyChatEvents,
      countUnreadMessages,
      createEmptyChatState,
      getOutgoingMessageStatus,
    } = await loadChatStateModule();

    expect(createEmptyChatState).toEqual(expect.any(Function));
    expect(applyChatEvents).toEqual(expect.any(Function));
    expect(countUnreadMessages).toEqual(expect.any(Function));
    expect(getOutgoingMessageStatus).toEqual(expect.any(Function));
  });

  it("keeps every fixture structurally replayable", () => {
    const cases = fixtures as FixtureCase[];

    expect(cases.map((item) => item.name)).toEqual([
      "hydrateConversation",
      "sendOptimisticMessage",
      "confirmSentMessage",
      "markMessageFailed",
      "markMessageFailedPreservesNewerDraft",
      "mergeRemoteMessage",
      "duplicateClientRequestIdReconciliation",
      "mergeReadState",
      "unreadCount",
      "deletedMessageSnippet",
      "replyPreview",
      "hydrateWindow",
      "olderPageLoaded",
      "olderPageDuplicateReconciliation",
      "gapBackfillOutOfOrder",
      "olderPageLifecycle",
      "deliveredMarkerOutsideWindow",
      "readMarkerOutsideWindow",
      "hydratePreservesUnresolvedSend",
      "hydrateWindowPreservesUnresolvedSend",
      "monotonicSentIgnoresLateFailure",
      "snippetLongAscii",
      "snippetEmojiBoundary",
      "olderPageRetryClearsError",
    ]);

    for (const fixture of cases) {
      expect(fixture).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          initialState: expect.any(Object),
          events: expect.any(Array),
        })
      );
      expect(fixture.expectedState ?? fixture.expectedSelectors).toBeDefined();
    }
  });

  // The protocol doc and its native companion declare an
  // update-together rule with the executable contract. Enforce it here so a
  // new fixture or pagination field cannot land without both canonical docs
  // naming it (T-09-06-01).
  it("keeps the canonical protocol and native docs in sync with the executable contract", () => {
    const repoRoot = join(__dirname, "..", "..", "..");
    const canonicalDocs = [
      join(repoRoot, "packages/core/docs/chat-state-protocol.md"),
      join(repoRoot, "packages/core/docs/native-chat-state-notes.md"),
    ].map((path) => ({ path, text: readFileSync(path, "utf8") }));

    const fixtureNames = (fixtures as FixtureCase[]).map((item) => item.name);
    const paginationFields = [
      "oldestLoadedCursor",
      "hasMoreOlder",
      "isLoadingOlder",
      "hasLoadError",
    ];

    for (const doc of canonicalDocs) {
      for (const name of [...fixtureNames, ...paginationFields]) {
        expect(doc.text, `${doc.path} must document "${name}"`).toContain(name);
      }
    }
  });

  it.each(fixtures as FixtureCase[])("replays $name", async (fixture) => {
    const {
      applyChatEvents,
      countUnreadMessages,
      getMessageSnippet,
      getOutgoingMessageStatus,
      toReplyPreview,
    } = await loadChatStateModule();
    const actual = applyChatEvents(fixture.initialState, fixture.events);

    if (fixture.expectedState) {
      expect(actual).toEqual(fixture.expectedState);
    }

    if (fixture.expectedSelectors?.unreadCount) {
      const { conversationId, currentUserId, readStateUserId, expected } =
        fixture.expectedSelectors.unreadCount;
      expect(
        countUnreadMessages(
          getConversation(actual, conversationId).messages,
          currentUserId,
          getReadState(actual, conversationId, readStateUserId)
        )
      ).toBe(expected);
    }

    if (fixture.expectedSelectors?.outgoingStatus) {
      const { conversationId, messageId, readStateUserId, expected } =
        fixture.expectedSelectors.outgoingStatus;
      const conversation = getConversation(actual, conversationId);
      expect(
        getOutgoingMessageStatus(
          getMessage(actual, conversationId, messageId),
          conversation.messages,
          getReadState(actual, conversationId, readStateUserId)
        )
      ).toBe(expected);
    }

    if (fixture.expectedSelectors?.snippet) {
      const { conversationId, messageId, expected } = fixture.expectedSelectors.snippet;
      expect(getMessageSnippet(getMessage(actual, conversationId, messageId))).toBe(
        expected
      );
    }

    if (fixture.expectedSelectors?.replyPreview) {
      const {
        conversationId,
        messageId,
        currentUserId,
        participantName,
        currentUserName,
        expected,
      } = fixture.expectedSelectors.replyPreview;
      expect(
        toReplyPreview(
          getMessage(actual, conversationId, messageId),
          currentUserId,
          participantName,
          currentUserName
        )
      ).toEqual(expected);
    }
  });
});
