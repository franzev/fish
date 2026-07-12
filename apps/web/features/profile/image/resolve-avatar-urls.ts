"use client";

import { getAvatarCommandService } from "@/lib/services/runtime/browser";
import {
  resolveAvatarUrlsSafely as resolveSafely,
  type AvatarUrlItem,
} from "@/lib/services";

export async function resolveAvatarUrlsSafely(
  profileIds: string[]
): Promise<AvatarUrlItem[]> {
  try {
    return await resolveSafely(getAvatarCommandService(), profileIds);
  } catch {
    return [];
  }
}
