export const chatSearchOperators = [
  "from",
  "in",
  "has",
  "mentions",
  "before",
  "after",
  "during",
  "author",
  "pinned",
] as const;

export type ChatSearchOperator = (typeof chatSearchOperators)[number];
export type ChatSearchDateOperator = "before" | "after" | "during";
export type ChatSearchContentKind =
  | "image"
  | "video"
  | "link"
  | "file"
  | "embed";
export type ChatSearchAuthorType = "client" | "coach";

export interface ChatSearchMember {
  id: string;
  displayName: string;
  username: string;
  role?: "client" | "coach";
  avatarUrl?: string;
}

export interface ChatSearchChannel {
  id: string;
  name: string;
  slug: string;
  conversationId: string;
}

export type ChatFilterCriterion =
  | {
      id: string;
      kind: "from" | "mentions";
      member: ChatSearchMember;
    }
  | {
      id: string;
      kind: "in";
      channel: ChatSearchChannel;
    }
  | {
      id: string;
      kind: "has";
      contentKind: ChatSearchContentKind;
    }
  | {
      id: string;
      kind: "date";
      operator: ChatSearchDateOperator;
      date: string;
    }
  | {
      id: string;
      kind: "author";
      authorType: ChatSearchAuthorType;
    }
  | {
      id: string;
      kind: "pinned";
      value: boolean;
    };

export interface ChatSearchToken {
  operator: ChatSearchOperator;
  value: string;
  start: number;
  end: number;
  valueStart: number;
  valueEnd: number;
}

export interface ParsedChatSearchQuery {
  text: string;
  tokens: ChatSearchToken[];
  activeToken: ChatSearchToken | null;
}

export interface ChatSearchRequest {
  conversationId: string;
  text: string;
  senderIds: string[];
  mentionedUserIds: string[];
  channelIds: string[];
  contentKinds: ChatSearchContentKind[];
  authorTypes: ChatSearchAuthorType[];
  pinned: boolean | null;
  dates: Array<{
    operator: ChatSearchDateOperator;
    date: string;
    timeZone: string;
  }>;
  cursor?: { createdAt: string; id: string } | null;
  offset?: number;
  sortDirection?: "asc" | "desc";
  limit?: number;
}
