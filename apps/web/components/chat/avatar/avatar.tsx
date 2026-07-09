"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { IconUser } from "@tabler/icons-react";
import { HTMLAttributes, useState } from "react";

export const avatarVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface-2 font-medium text-body",
  {
    variants: {
      size: {
        /* xs rides the badge size token — inline identity chips (reply previews).
           Initials use the smallest UI text token: at this diameter, text-ui-2xs
           (12px) crowds two glyphs against the pill's edge. */
        xs: "size-badge text-ui-3xs",
        sm: "size-8 text-ui-xs",
        md: "size-10 text-ui",
        lg: "size-14 text-copy",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>["size"]>;

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  size?: AvatarSize;
}

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
      className={cn(avatarVariants({ size }), className)}
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
