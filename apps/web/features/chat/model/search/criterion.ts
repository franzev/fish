import type {
  ChatFilterCriterion,
  ChatSearchAuthorType,
  ChatSearchChannel,
  ChatSearchContentKind,
  ChatSearchDateOperator,
  ChatSearchMember,
} from "./types";

export function makeCriterion(
  kind: "from" | "mentions",
  member: ChatSearchMember
): Extract<ChatFilterCriterion, { kind: "from" | "mentions" }>;
export function makeCriterion(
  kind: "in",
  channel: ChatSearchChannel
): Extract<ChatFilterCriterion, { kind: "in" }>;
export function makeCriterion(
  kind: "has",
  contentKind: ChatSearchContentKind
): Extract<ChatFilterCriterion, { kind: "has" }>;
export function makeCriterion(
  kind: "author",
  authorType: ChatSearchAuthorType
): Extract<ChatFilterCriterion, { kind: "author" }>;
export function makeCriterion(
  kind: "pinned",
  value: boolean
): Extract<ChatFilterCriterion, { kind: "pinned" }>;
export function makeCriterion(
  kind: "date",
  value: { operator: ChatSearchDateOperator; date: string },
  suffix?: string
): Extract<ChatFilterCriterion, { kind: "date" }>;
export function makeCriterion(
  kind: ChatFilterCriterion["kind"],
  value:
    | ChatSearchMember
    | ChatSearchChannel
    | ChatSearchContentKind
    | ChatSearchAuthorType
    | boolean
    | { operator: ChatSearchDateOperator; date: string },
  suffix?: string
): ChatFilterCriterion {
  const id = (base: string) => (suffix ? `${base}:${suffix}` : base);
  switch (kind) {
    case "from":
    case "mentions": {
      const member = value as ChatSearchMember;
      return { id: id(`${kind}:${member.id}`), kind, member };
    }
    case "in": {
      const channel = value as ChatSearchChannel;
      return { id: id(`${kind}:${channel.id}`), kind, channel };
    }
    case "has": {
      const contentKind = value as ChatSearchContentKind;
      return { id: id(`${kind}:${contentKind}`), kind, contentKind };
    }
    case "author": {
      const authorType = value as ChatSearchAuthorType;
      return { id: id(`${kind}:${authorType}`), kind, authorType };
    }
    case "pinned": {
      const pinned = value as boolean;
      return { id: id(`${kind}:${pinned}`), kind, value: pinned };
    }
    case "date": {
      const date = value as { operator: ChatSearchDateOperator; date: string };
      return { id: id(`${date.operator}:${date.date}`), kind, ...date };
    }
  }
}
