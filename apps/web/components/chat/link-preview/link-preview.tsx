import { cn } from "@/lib/utils";
import { IconPlayerPlay } from "@tabler/icons-react";
import { AnchorHTMLAttributes } from "react";

interface LinkPreviewProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  url: string;
  title: string;
  source: string;
  thumbnailUrl?: string;
}

/** A YouTube-style rich link card: thumbnail, title, source label — wrapped
 *  in a single focusable `<a>` so the whole card is one tap target, not a
 *  cluster of competing controls. */
export function LinkPreview({
  url,
  title,
  source,
  thumbnailUrl,
  className,
  ...props
}: LinkPreviewProps) {
  return (
    <a
      href={url}
      className={cn(
        "block overflow-hidden rounded-card border border-border bg-surface transition-colors hover:bg-surface-2",
        className
      )}
      {...props}
    >
      <div className="relative flex h-36 w-full items-center justify-center bg-surface-2">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-ui-xs text-muted">Link preview</span>
        )}
        <span className="absolute flex size-12 items-center justify-center rounded-pill bg-primary text-on-primary">
          <IconPlayerPlay size={20} stroke={1.75} aria-hidden="true" />
        </span>
      </div>
      <div className="p-sm">
        <p className="line-clamp-2 text-ui-sm font-medium text-foreground">{title}</p>
        <p className="mt-2xs text-ui-xs text-muted">{source}</p>
      </div>
    </a>
  );
}
