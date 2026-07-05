"use client";

import { cn } from "@/lib/utils";
import { IconUser } from "@tabler/icons-react";
import { HTMLAttributes, useState } from "react";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "size-8 text-ui-xs",
  md: "size-10 text-ui",
  lg: "size-14 text-copy",
};

/** Derive up to two uppercase initials from a display name. Never throws —
 *  falls back to an empty string for names with no usable characters. */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}

/** Image -> initials -> neutral placeholder, in that order. A broken/missing
 *  `src` (or an image `onError`) falls through to initials, and no name at
 *  all falls through to a plain glyph — the chain never crashes. */
export function Avatar({ src, name, size = "md", className, ...props }: AvatarProps) {
  // Track the src that failed, not a boolean — so a later change to a new,
  // valid src (e.g. switching conversations reuses this instance) shows the
  // new image instead of staying stuck on the previous load error.
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const showImage = Boolean(src) && src !== failedSrc;
  const initials = name ? initialsFrom(name) : "";

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface-2 font-medium text-body",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ? `${name}'s avatar` : "User avatar"}
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <IconUser size={20} stroke={1.75} aria-hidden="true" className="text-muted" />
      )}
      {!showImage && !initials && <span className="sr-only">User avatar</span>}
    </div>
  );
}
