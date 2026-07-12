"use client";

import { getAvatarCommandService } from "@/lib/services/runtime/browser";
import type { AvatarUrlItem } from "@/lib/services";

export async function resolveAvatarUrlsSafely(
  profileIds: string[]
): Promise<AvatarUrlItem[]> {
  try {
    return await getAvatarCommandService().resolveUrls(profileIds);
  } catch {
    return [];
  }
}
