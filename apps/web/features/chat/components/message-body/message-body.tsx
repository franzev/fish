import { cn } from "@/lib/utils";
import { Fragment, type ReactNode } from "react";
import {
  EMOJI_ONLY_RE,
  INLINE_RE,
  sanitizeHref,
  tokenize,
  type BlockToken,
  type ListToken,
} from "./message-body-parser";

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



/* ---- Inline parsing (bold/italic/code/links) + link sanitization ---- */

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
        <blockquote key={key} className="mt-sm rounded-control border border-current/30 px-sm py-xs text-current/90">
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
  const isEmojiOnly = EMOJI_ONLY_RE.test(body);

  return (
    <div
      className={cn(
        "flex flex-col break-words [&>*:first-child]:mt-0",
        isEmojiOnly && "text-display",
        className
      )}
    >
      {blocks.map((block, index) => renderBlock(block, `b${index}`, mine))}
    </div>
  );
}
