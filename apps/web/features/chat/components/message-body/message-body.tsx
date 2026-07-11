import { cn } from "@/lib/utils";
import { Fragment, type ReactNode } from "react";

interface MessageBodyProps {
  body: string;
  /** Sent (true) vs received (false) — flips link/code well contrast so both
   *  the inverted `bg-primary` bubble and the plain `bg-surface` bubble stay
   *  legible. Not a color prop; see Bubble for the same pattern. */
  mine?: boolean;
  className?: string;
}

/* ---- Block tokens — a compact, line-by-line parser (NOT a full CommonMark
   engine). Every feature below is intentionally minimal: it exists so chat
   copy reads with structure instead of literal markdown characters, never to
   become a general-purpose renderer. */

interface CodeBlockToken {
  type: "code";
  lang?: string;
  code: string;
}

interface HeadingToken {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

interface BlockquoteToken {
  type: "blockquote";
  lines: string[];
}

interface ListItemToken {
  text: string;
  children?: ListToken;
}

interface ListToken {
  type: "list";
  ordered: boolean;
  items: ListItemToken[];
}

interface ParagraphToken {
  type: "paragraph";
  lines: string[];
}

type BlockToken =
  | CodeBlockToken
  | HeadingToken
  | BlockquoteToken
  | ListToken
  | ParagraphToken;

const FENCE_OPEN_RE = /^```\s*(\S*)\s*$/;
const FENCE_CLOSE_RE = /^```\s*$/;
const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const LIST_ITEM_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

function isListItemLine(line: string): boolean {
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

function parseList(lines: string[], start: number, indent: number): { list: ListToken; nextIndex: number } {
  const firstMatch = lines[start].match(LIST_ITEM_RE);
  const ordered = firstMatch ? /^\d+\.$/.test(firstMatch[2]) : false;
  const items: ListItemToken[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      // A lone blank line inside a list is tolerated (keeps items together);
      // anything after it that isn't another list line ends the list below.
      i += 1;
      continue;
    }
    const match = line.match(LIST_ITEM_RE);
    if (!match) {
      break;
    }
    const lineIndent = match[1].length;
    if (lineIndent < indent) {
      break;
    }
    if (lineIndent > indent) {
      if (items.length === 0) {
        break;
      }
      const nested = parseList(lines, i, lineIndent);
      items[items.length - 1].children = nested.list;
      i = nested.nextIndex;
      continue;
    }
    items.push({ text: match[3] });
    i += 1;
  }

  return { list: { type: "list", ordered, items }, nextIndex: i };
}

function tokenize(body: string): BlockToken[] {
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
      i += 1; // consume the closing fence (or end of input)
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
    while (i < lines.length && lines[i].trim() !== "" && !isOtherBlockStart(lines[i])) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

/* ---- Inline parsing (bold/italic/code/links) + link sanitization ---- */

/* The link URL group tolerates one level of balanced parens inside the URL
   (e.g. `javascript:alert(1)`, or a legitimate `.../Article_(disambiguation)`
   link) so the whole scheme is captured for sanitization — a naive
   `[^)]+` stops at the first inner `)` and leaves a dangling paren as
   literal text instead of neutralizing the full URL. */
const INLINE_RE =
  /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)/g;

/** SECURITY (T-p06-02): only http/https/mailto hrefs are allowed. Anything
 *  else (javascript:, data:, etc.) is neutralized — the link renders as
 *  plain text with no href, never a clickable/executable URL. */
function sanitizeHref(url: string): string | null {
  const trimmed = url.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : null;
}

function parseInline(text: string, keyPrefix: string, mine?: boolean): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [, code, bold, italicStar, italicUnderscore, linkText, linkUrl] = match;

    if (code !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-i${key++}`}
          className={cn(
            "rounded-control px-2xs py-3xs font-mono text-ui-xs",
            mine ? "bg-on-primary/10" : "bg-surface-2"
          )}
        >
          {code}
        </code>
      );
    } else if (bold !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-i${key++}`}>{bold}</strong>);
    } else if (italicStar !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${key++}`}>{italicStar}</em>);
    } else if (italicUnderscore !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${key++}`}>{italicUnderscore}</em>);
    } else if (linkText !== undefined && linkUrl !== undefined) {
      const href = sanitizeHref(linkUrl);
      if (href) {
        nodes.push(
          <a
            key={`${keyPrefix}-i${key++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-current underline underline-offset-2"
          >
            {linkText}
          </a>
        );
      } else {
        nodes.push(linkText);
      }
    }

    lastIndex = INLINE_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/* ---- Block rendering ---- */

const HEADING_TAGS = { 1: "h1", 2: "h2", 3: "h3" } as const;
const HEADING_CLASSES = {
  1: "text-heading-sm font-semibold",
  2: "text-ui-md font-semibold",
  3: "text-ui-sm font-semibold",
} as const;

function renderLines(lines: string[], keyPrefix: string, mine?: boolean): ReactNode {
  return lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-l${index}`}>
      {index > 0 && <br />}
      {parseInline(line, `${keyPrefix}-l${index}`, mine)}
    </Fragment>
  ));
}

function renderList(
  list: ListToken,
  keyPrefix: string,
  mine?: boolean,
  className?: string
): ReactNode {
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag
      key={keyPrefix}
      className={cn(
        "flex flex-col gap-xs pl-md",
        list.ordered ? "list-decimal" : "list-disc",
        className
      )}
    >
      {list.items.map((item, index) => (
        <li key={`${keyPrefix}-${index}`}>
          {parseInline(item.text, `${keyPrefix}-${index}`, mine)}
          {item.children && renderList(item.children, `${keyPrefix}-${index}-child`, mine, "mt-xs")}
        </li>
      ))}
    </Tag>
  );
}

function renderBlock(block: BlockToken, key: string, mine?: boolean): ReactNode {
  switch (block.type) {
    case "code":
      return (
        <pre
          key={key}
          className={cn(
            "mt-sm overflow-x-auto rounded-control p-sm font-mono text-ui-xs",
            mine ? "bg-on-primary/10" : "bg-surface-2"
          )}
        >
          {block.lang && (
            <div
              className={cn(
                "mb-2xs text-ui-2xs uppercase tracking-widest",
                mine ? "text-on-primary/70" : "text-muted"
              )}
            >
              {block.lang}
            </div>
          )}
          <code>{block.code}</code>
        </pre>
      );
    case "heading": {
      const Tag = HEADING_TAGS[block.level];
      // A heading starts a new section, so it needs more space above it than
      // the gap between paragraphs — proximity binds it to the copy below.
      return (
        <Tag key={key} className={cn("mt-lg font-sans text-current", HEADING_CLASSES[block.level])}>
          {parseInline(block.text, key, mine)}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key} className="mt-sm border-l-2 border-current/30 pl-sm text-current/90">
          {renderLines(block.lines, key, mine)}
        </blockquote>
      );
    case "list":
      return renderList(block, key, mine, "mt-sm");
    case "paragraph":
      return (
        <p key={key} className="mt-sm">
          {renderLines(block.lines, key, mine)}
        </p>
      );
    default:
      return null;
  }
}

/** Self-contained rich-text renderer for chat message bodies — bold, italic,
 *  inline/fenced code, bullet/numbered lists (incl. nesting), headings,
 *  blockquotes, links, and preserved line breaks. Builds React elements
 *  directly (never `dangerouslySetInnerHTML`) and sanitizes link hrefs to
 *  http/https/mailto only (T-p06-01, T-p06-02). No new npm dependency. */
export function MessageBody({ body, mine, className }: MessageBodyProps) {
  if (!body || body.trim() === "") {
    return null;
  }

  const blocks = tokenize(body);

  return (
    <div className={cn("flex flex-col break-words [&>*:first-child]:mt-0", className)}>
      {blocks.map((block, index) => renderBlock(block, `b${index}`, mine))}
    </div>
  );
}
