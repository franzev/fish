import type {
  ChatFilterCriterion,
  ChatSearchChannel,
  ChatSearchContentKind,
  ChatSearchMember,
  ChatSearchOperator,
  ChatSearchToken,
} from "./types";
import { makeCriterion } from "./criterion";

export type SearchSuggestion =
  | { kind: "member"; member: ChatSearchMember }
  | { kind: "channel"; channel: ChatSearchChannel }
  | { kind: "content"; value: ChatSearchContentKind }
  | { kind: "author"; value: "client" | "coach" }
  | { kind: "pinned"; value: boolean }
  | { kind: "date"; value: string };

export function suggestionValue(suggestion: SearchSuggestion): string {
  if (suggestion.kind === "member") return suggestion.member.username;
  if (suggestion.kind === "channel") return suggestion.channel.slug;
  return String(suggestion.value);
}

export function criterionFromSuggestion(
  operator: ChatSearchOperator,
  suggestion: SearchSuggestion
): ChatFilterCriterion | null {
  if (
    (operator === "from" || operator === "mentions") &&
    suggestion.kind === "member"
  ) {
    return makeCriterion(operator, suggestion.member);
  }
  if (operator === "in" && suggestion.kind === "channel") {
    return makeCriterion("in", suggestion.channel);
  }
  if (operator === "has" && suggestion.kind === "content") {
    return makeCriterion("has", suggestion.value);
  }
  if (operator === "author" && suggestion.kind === "author") {
    return makeCriterion("author", suggestion.value);
  }
  if (operator === "pinned" && suggestion.kind === "pinned") {
    return makeCriterion("pinned", suggestion.value);
  }
  if (
    (operator === "before" || operator === "after" || operator === "during") &&
    suggestion.kind === "date"
  ) {
    return makeCriterion("date", { operator, date: suggestion.value });
  }
  return null;
}

export function suggestionsForToken(
  token: Pick<ChatSearchToken, "operator" | "value">,
  members: ChatSearchMember[],
  channels: ChatSearchChannel[],
  today = new Date().toISOString().slice(0, 10)
): SearchSuggestion[] {
  const query = token.value.trim().toLocaleLowerCase();
  if (token.operator === "from" || token.operator === "mentions") {
    return members
      .filter((member) =>
        `${member.displayName} ${member.username}`
          .toLocaleLowerCase()
          .includes(query)
      )
      .map((member) => ({ kind: "member" as const, member }));
  }
  if (token.operator === "in") {
    return channels
      .filter((channel) =>
        `${channel.name} ${channel.slug}`.toLocaleLowerCase().includes(query)
      )
      .map((channel) => ({ kind: "channel" as const, channel }));
  }
  if (token.operator === "has") {
    return (["image", "video", "link", "file", "embed"] as const)
      .filter((kind) => kind.includes(query))
      .map((value) => ({ kind: "content" as const, value }));
  }
  if (token.operator === "author") {
    return (["client", "coach"] as const)
      .filter((value) => value.includes(query))
      .map((value) => ({ kind: "author" as const, value }));
  }
  if (token.operator === "pinned") {
    return ([true, false] as const)
      .filter((value) => String(value).includes(query))
      .map((value) => ({ kind: "pinned" as const, value }));
  }
  return [
    {
      kind: "date",
      value: /^\d{4}-\d{2}-\d{2}$/.test(token.value) ? token.value : today,
    },
  ];
}
