import { CommunityMessageRowLayout } from "../community-message-row-layout";

const contentLineClassName = "flex h-skeleton-text gap-nudge";
const contentWordClassName =
  "h-full rounded-pill bg-surface-2 animate-skeleton-pulse";
const paragraphLines = [
  [
    {
      className: "w-11/12",
      words: [
        "basis-[12%]",
        "basis-[19%]",
        "basis-[8%]",
        "basis-[24%]",
        "basis-[13%]",
        "flex-1",
      ],
    },
    {
      className: "w-3/4",
      words: [
        "basis-[18%]",
        "basis-[10%]",
        "basis-[27%]",
        "basis-[14%]",
        "flex-1",
      ],
    },
  ],
  [
    {
      className: "w-5/6",
      words: [
        "basis-[9%]",
        "basis-[23%]",
        "basis-[15%]",
        "basis-[8%]",
        "basis-[20%]",
        "flex-1",
      ],
    },
    {
      className: "w-7/12",
      words: ["basis-[24%]", "basis-[13%]", "basis-[29%]", "flex-1"],
    },
  ],
] as const;

/** One deterministic community message with two paragraph-shaped text blocks. */
export function MessageRowsSkeleton() {
  return (
    <div aria-hidden="true" data-testid="load-older-skeleton">
      <CommunityMessageRowLayout
        avatarSlot={
          <div
            data-testid="skeleton-avatar"
            className="size-8 shrink-0 rounded-pill bg-surface-2 animate-skeleton-pulse"
          />
        }
        startsGroup
        hasPrecedingRow
        interactive={false}
        data-testid="skeleton-row-author"
      >
        <div
          data-testid="skeleton-meta"
          className="mb-xs flex items-baseline text-muted"
        >
          <span
            data-testid="skeleton-author"
            className="h-skeleton-text w-skeleton-author rounded-pill bg-skeleton-author animate-skeleton-pulse"
          />
        </div>
        <div className="flex w-full flex-col gap-sm">
          {paragraphLines.map((lines, paragraphIndex) => (
            <div
              key={paragraphIndex}
              data-testid="skeleton-paragraph"
              className="flex w-full flex-col gap-nudge"
            >
              {lines.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  data-testid="skeleton-content-line"
                  className={`${contentLineClassName} ${line.className}`}
                >
                  {line.words.map((wordClassName, wordIndex) => (
                    <span
                      key={wordIndex}
                      data-testid="skeleton-content-word"
                      className={`${contentWordClassName} ${wordClassName}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </CommunityMessageRowLayout>
    </div>
  );
}
