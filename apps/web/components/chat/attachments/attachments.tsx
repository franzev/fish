import { cn } from "@/lib/utils";
import { IconFile, IconPlayerPlay } from "@tabler/icons-react";
import { HTMLAttributes } from "react";
import type { Attachment } from "../types";

interface AttachmentsProps extends HTMLAttributes<HTMLDivElement> {
  attachments?: Attachment[];
}

/** Renders a list of attachment cards — image/video/file/audio. Presentational
 *  only: no real media decode, just token-styled previews and metadata. */
export function Attachments({ attachments, className, ...props }: AttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {attachments.map((attachment, index) => (
        <AttachmentCard key={`${attachment.kind}-${attachment.url}-${index}`} attachment={attachment} />
      ))}
    </div>
  );
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={attachment.url}
        alt={attachment.name}
        className="max-h-64 w-full rounded-control border border-border object-cover"
      />
    );
  }

  if (attachment.kind === "video") {
    return (
      <div className="relative overflow-hidden rounded-control border border-border bg-surface-2">
        {attachment.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.poster} alt="" className="max-h-64 w-full object-cover" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center">
            <span className="text-[13px] text-muted">Video preview</span>
          </div>
        )}
        <button
          type="button"
          aria-label={`Play video ${attachment.name}`}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex size-12 items-center justify-center rounded-pill bg-primary text-on-primary">
            <IconPlayerPlay size={20} stroke={1.75} aria-hidden="true" />
          </span>
        </button>
        {attachment.duration && (
          <span className="absolute bottom-2 right-2 rounded-pill bg-surface px-2 py-0.5 text-[12px] text-body">
            {attachment.duration}
          </span>
        )}
      </div>
    );
  }

  if (attachment.kind === "audio") {
    return (
      <div className="flex items-center gap-3 rounded-control border border-border bg-surface p-3">
        <button
          type="button"
          aria-label={`Play audio ${attachment.name}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary"
        >
          <IconPlayerPlay size={18} stroke={1.75} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] text-body">{attachment.name}</p>
          {attachment.duration && (
            <p className="text-[13px] text-muted">{attachment.duration}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <a
      href={attachment.url}
      className="flex items-center gap-3 rounded-control border border-border bg-surface p-3 transition-colors hover:bg-surface-2"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-2 text-muted">
        <IconFile size={20} stroke={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] text-body">{attachment.name}</p>
        <p className="text-[13px] text-muted">{attachment.size}</p>
      </div>
    </a>
  );
}
