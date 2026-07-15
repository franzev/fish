"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { IconUser } from "@tabler/icons-react";
import { HTMLAttributes, useState } from "react";
import { useRef } from "react";
import { getAvatarCommandService } from "@/lib/services/runtime/browser";

export const avatarVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-avatar font-medium text-foreground",
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
        profile: "size-profile-avatar text-heading-sm",
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
  profileId?: string;
  name?: string;
  size?: AvatarSize;
  alt?: string;
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
export function Avatar({
  src,
  profileId,
  name,
  size = "md",
  alt,
  className,
  ...props
}: AvatarProps) {
  // Track the src that failed, not a boolean — so a later change to a new,
  // valid src (e.g. switching conversations reuses this instance) shows the
  // new image instead of staying stuck on the previous load error.
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const [refreshed, setRefreshed] = useState<{ profileId: string; url: string } | null>(null);
  const attemptedRefresh = useRef<string | null>(null);
  const activeSrc = refreshed && refreshed.profileId === profileId ? refreshed.url : src;
  const showImage = Boolean(activeSrc) && activeSrc !== failedSrc;
  const initials = name ? initialsFrom(name) : "";

  async function handleImageError() {
    if (profileId && attemptedRefresh.current !== `${profileId}:${activeSrc}`) {
      attemptedRefresh.current = `${profileId}:${activeSrc}`;
      let item: Awaited<ReturnType<ReturnType<typeof getAvatarCommandService>["resolveUrls"]>>[number] | undefined;
      try {
        item = (await getAvatarCommandService().resolveUrls([profileId]))[0];
      } catch {
        item = undefined;
      }
      if (item?.url && item.url !== activeSrc) {
        setRefreshed({ profileId, url: item.url });
        return;
      }
    }
    setFailedSrc(activeSrc);
  }

  return (
    <div
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeSrc}
          alt={alt ?? (name ? `${name}'s avatar` : "User avatar")}
          className="size-full object-cover"
          onError={handleImageError}
        />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <IconUser size={20} stroke={1.75} aria-hidden="true" className="text-foreground" />
      )}
      {!showImage && !initials && <span className="sr-only">User avatar</span>}
    </div>
  );
}
