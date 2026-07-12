import type { AvatarCommandService, AvatarUrlItem } from "./contracts";

export async function resolveAvatarUrlsSafely(
  service: AvatarCommandService | null | undefined,
  profileIds: string[],
  variant: "thumbnail" | "display" = "thumbnail"
): Promise<AvatarUrlItem[]> {
  if (!service || profileIds.length === 0) return [];

  try {
    return await service.resolveUrls(profileIds, variant);
  } catch {
    return [];
  }
}
