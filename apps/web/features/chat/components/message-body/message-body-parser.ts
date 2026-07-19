export interface CodeBlockToken {
  type: "code";
  lang?: string;
  code: string;
}

export interface HeadingToken {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

export interface BlockquoteToken {
  type: "blockquote";
  lines: string[];
}

export interface ListItemToken {
  text: string;
  children?: ListToken;
}

export interface ListToken {
  type: "list";
  ordered: boolean;
  items: ListItemToken[];
}

export interface ParagraphToken {
  type: "paragraph";
  lines: string[];
}

export type BlockToken =
  | CodeBlockToken
  | HeadingToken
  | BlockquoteToken
  | ListToken
  | ParagraphToken;

export const FENCE_OPEN_RE = /^```\s*(\S*)\s*$/;
export const FENCE_CLOSE_RE = /^```\s*$/;
export const HEADING_RE = /^(#{1,3})\s+(.*)$/;
export const BLOCKQUOTE_RE = /^>\s?(.*)$/;
export const LIST_ITEM_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

export const EMOJI_ONLY_RE =
  /^\s*(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)\s*$/u;

export function isListItemLine(line: string): boolean {
  return LIST_ITEM_RE.test(line);
}

function isOtherBlockStart(line: string): boolean {
  return (
    FENCE_OPEN_RE.test(line) ||
    HEADING_RE.test(line) ||
    BLOCKQUOTE_RE.test(line) ||
    isListItemLine(line)
  );
}

export function parseList(
  lines: string[],
  start: number,
  indent: number
): { list: ListToken; nextIndex: number } {
  const firstMatch = lines[start]?.match(LIST_ITEM_RE);
  const ordered = firstMatch ? /^\d+\.$/.test(firstMatch[2]) : false;
  const items: ListItemToken[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const match = line.match(LIST_ITEM_RE);
    if (!match) break;
    const lineIndent = match[1].length;
    if (lineIndent < indent) break;
    if (lineIndent > indent) {
      if (items.length === 0) break;
      const nested = parseList(lines, i, lineIndent);
      items[items.length - 1].children = nested.list;
      i = nested.nextIndex;
      continue;
    }
    if (/^\d+\.$/.test(match[2]) !== ordered) break;
    items.push({ text: match[3] });
    i += 1;
  }

  return { list: { type: "list", ordered, items }, nextIndex: i };
}

export function tokenize(body: string): BlockToken[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const fenceMatch = line.match(FENCE_OPEN_RE);
    if (fenceMatch) {
      const lang = fenceMatch[1] || undefined;
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", lang, code: codeLines.join("\n") });
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      i += 1;
      continue;
    }

    if (BLOCKQUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && BLOCKQUOTE_RE.test(lines[i])) {
        quoteLines.push(lines[i].replace(BLOCKQUOTE_RE, "$1"));
        i += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    if (isListItemLine(line)) {
      const { list, nextIndex } = parseList(lines, i, 0);
      blocks.push(list);
      i = nextIndex;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isOtherBlockStart(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

export const INLINE_RE =
  /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)/g;

export function sanitizeHref(url: string): string | null {
  const trimmed = url.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : null;
}
