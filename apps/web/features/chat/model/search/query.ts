import {
  chatSearchOperators,
  type ChatFilterCriterion,
  type ChatSearchOperator,
  type ChatSearchChannel,
  type ChatSearchMember,
  type ChatSearchToken,
  type ParsedChatSearchQuery,
} from "./types";

const operatorPattern = chatSearchOperators.join("|");
const tokenPattern = new RegExp(
  `(^|\\s)(${operatorPattern}):[\\t ]*(?:\"([^\"]*)\"|(\\S*))?`,
  "gi"
);

export function parseChatSearchQuery(
  value: string,
  caret = value.length
): ParsedChatSearchQuery {
  const tokens: ChatSearchToken[] = [];
  const textParts: string[] = [];
  let textStart = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const leadingWhitespace = match[1] ?? "";
    const operator = match[2]?.toLowerCase() as ChatSearchOperator | undefined;
    if (!operator || match.index === undefined) continue;

    const start = match.index + leadingWhitespace.length;
    const end = match.index + match[0].length;
    const rawValue = match[3] ?? match[4] ?? "";
    const valueStart = rawValue
      ? match.index + match[0].lastIndexOf(rawValue)
      : end;
    const valueEnd = valueStart + rawValue.length;

    textParts.push(value.slice(textStart, match.index));
    tokens.push({
      operator,
      value: rawValue,
      start,
      end,
      valueStart,
      valueEnd,
    });
    textStart = end;
  }

  textParts.push(value.slice(textStart));
  const activeToken =
    [...tokens]
      .reverse()
      .find(
        (token) =>
          caret >= token.valueStart &&
          caret <= token.end &&
          !value.slice(token.valueStart, caret).includes(" ")
      ) ?? null;

  return {
    text: textParts.join(" ").replace(/\s+/g, " ").trim(),
    tokens,
    activeToken,
  };
}

export function replaceChatSearchToken(
  query: string,
  token: ChatSearchToken,
  replacementValue: string
): { value: string; caret: number } {
  const needsQuotes = /\s/.test(replacementValue);
  const replacement = `${token.operator}: ${
    needsQuotes ? `"${replacementValue}"` : replacementValue
  }`;
  const suffix = query.slice(token.end);
  const separator = suffix.startsWith(" ") || suffix.length === 0 ? "" : " ";
  const value = `${query.slice(0, token.start)}${replacement}${separator}${suffix}`;
  const caret = token.start + replacement.length + (suffix.length === 0 ? 1 : 0);

  return {
    value: suffix.length === 0 ? `${value} ` : value,
    caret,
  };
}

export function appendChatSearchOperator(
  query: string,
  operator: ChatSearchOperator
): { value: string; caret: number } {
  const prefix = query.trimEnd();
  const value = `${prefix}${prefix ? " " : ""}${operator}:`;
  return { value, caret: value.length };
}

export function criterionTokenValue(criterion: ChatFilterCriterion): string {
  switch (criterion.kind) {
    case "from":
    case "mentions":
      return criterion.member.username;
    case "in":
      return criterion.channel.slug;
    case "has":
      return criterion.contentKind;
    case "date":
      return criterion.date;
    case "author":
      return criterion.authorType;
    case "pinned":
      return String(criterion.value);
  }
}

export function criterionOperator(
  criterion: ChatFilterCriterion
): ChatSearchOperator {
  return criterion.kind === "date" ? criterion.operator : criterion.kind;
}

export function criterionKey(criterion: ChatFilterCriterion): string {
  return `${criterionOperator(criterion)}:${criterionTokenValue(criterion).toLowerCase()}`;
}

export function reconcileCriteria(
  query: string,
  criteria: ChatFilterCriterion[]
): ChatFilterCriterion[] {
  const present = new Set(
    parseChatSearchQuery(query).tokens
      .filter((token) => token.value.length > 0)
      .map((token) => `${token.operator}:${token.value.toLowerCase()}`)
  );
  return criteria.filter((criterion) => present.has(criterionKey(criterion)));
}

export function queryFromCriteria(
  text: string,
  criteria: ChatFilterCriterion[]
): string {
  const tokens = criteria.map((criterion) => {
    const value = criterionTokenValue(criterion);
    return `${criterionOperator(criterion)}: ${
      /\s/.test(value) ? `"${value}"` : value
    }`;
  });
  return [text.trim(), ...tokens].filter(Boolean).join(" ");
}

export function criteriaFromQuery(
  query: string,
  members: ChatSearchMember[],
  channels: ChatSearchChannel[]
): ChatFilterCriterion[] {
  const memberByUsername = new Map(
    members.map((member) => [member.username.toLocaleLowerCase(), member])
  );
  const channelBySlug = new Map(
    channels.map((channel) => [channel.slug.toLocaleLowerCase(), channel])
  );
  const criteria = parseChatSearchQuery(query).tokens.flatMap<ChatFilterCriterion>(
    (token) => {
      const value = token.value.toLocaleLowerCase();
      if (token.operator === "from" || token.operator === "mentions") {
        const member = memberByUsername.get(value);
        return member
          ? [{ id: `${token.operator}:${member.id}`, kind: token.operator, member }]
          : [];
      }
      if (token.operator === "in") {
        const channel = channelBySlug.get(value);
        return channel ? [{ id: `in:${channel.id}`, kind: "in", channel }] : [];
      }
      if (
        token.operator === "has" &&
        ["image", "video", "link", "file", "embed"].includes(value)
      ) {
        return [{ id: `has:${value}`, kind: "has", contentKind: value as Extract<ChatFilterCriterion, { kind: "has" }>["contentKind"] }];
      }
      if (token.operator === "author" && (value === "client" || value === "coach")) {
        return [{ id: `author:${value}`, kind: "author", authorType: value }];
      }
      if (token.operator === "pinned" && (value === "true" || value === "false")) {
        return [{ id: `pinned:${value}`, kind: "pinned", value: value === "true" }];
      }
      if (
        (token.operator === "before" || token.operator === "after" || token.operator === "during") &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return [{ id: `${token.operator}:${value}`, kind: "date", operator: token.operator, date: value }];
      }
      return [];
    }
  );
  return [...new Map(criteria.map((criterion) => [criterion.id, criterion])).values()];
}
