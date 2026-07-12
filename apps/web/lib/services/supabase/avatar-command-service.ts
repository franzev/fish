import type {
  AvatarCommandService,
  AvatarUploadAuthorization,
  AvatarUrlItem,
} from "../contracts";
import type { AppSupabaseClient } from "./types";
import { getPublicEnv } from "../env";

function signedUploadUrl(objectPath: string, uploadToken: string): string {
  const baseUrl = getPublicEnv().supabaseUrl.replace(/\/$/, "");
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/upload/sign/avatars/${encodedPath}?token=${encodeURIComponent(uploadToken)}`;
}

function publicStorageUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const publicOrigin = new URL(getPublicEnv().supabaseUrl).origin;
  const signed = new URL(value);
  return `${publicOrigin}${signed.pathname}${signed.search}`;
}

async function invoke<T>(
  client: AppSupabaseClient,
  body: Record<string, unknown>,
  timeout = 15_000
): Promise<T> {
  const result = await client.functions.invoke<T>("avatar-command", {
    body,
    timeout,
  });
  if (!result.error && result.data) return result.data;

  let message = result.error?.message;
  const context = result.error && "context" in result.error
    ? result.error.context
    : null;
  if (context instanceof Response) {
    const payload = await context.json().catch(() => null) as {
      error?: string;
    } | null;
    message = payload?.error || message;
  }
  throw new Error(message || "That avatar action did not finish yet.");
}

export class SupabaseAvatarCommandService implements AvatarCommandService {
  constructor(private readonly client: AppSupabaseClient) {}

  async initialize(input: {
    clientUploadId: string;
    originalName: string;
    sourceMimeType: string;
    sourceByteSize: number;
  }): Promise<AvatarUploadAuthorization> {
    const result = await invoke<AvatarUploadAuthorization>(
      this.client,
      { action: "initialize-upload", ...input }
    );
    return {
      ...result,
      signedUploadUrl: signedUploadUrl(result.objectPath, result.uploadToken),
    };
  }

  async complete(uploadId: string) {
    const result = await invoke<{
      profileId: string;
      avatarUrl?: string;
      avatarThumbnailUrl?: string;
      updatedAt: string;
    }>(this.client, { action: "complete-upload", uploadId }, 45_000);
    return {
      ...result,
      avatarUrl: publicStorageUrl(result.avatarUrl),
      avatarThumbnailUrl: publicStorageUrl(result.avatarThumbnailUrl),
    };
  }

  async cancel(uploadId: string): Promise<void> {
    await invoke(this.client, { action: "cancel-upload", uploadId });
  }

  async remove(): Promise<void> {
    await invoke(this.client, { action: "remove-avatar" });
  }

  async resolveUrls(
    profileIds: string[],
    variant: "thumbnail" | "display" = "thumbnail"
  ): Promise<AvatarUrlItem[]> {
    if (profileIds.length === 0) return [];
    const result = await invoke<{ items: AvatarUrlItem[] }>(this.client, {
      action: "resolve-urls",
      profileIds: [...new Set(profileIds)].slice(0, 100),
      variant,
    });
    return result.items.map((item) => ({
      ...item,
      url: publicStorageUrl(item.url) ?? item.url,
    }));
  }
}
