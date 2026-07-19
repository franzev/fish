export interface AvatarUploadAuthorization {
  uploadId: string;
  bucket: "avatars";
  objectPath: string;
  uploadToken: string;
  signedUploadUrl: string;
  expiresAt: string;
}

export interface AvatarUrlItem {
  profileId: string;
  url: string;
  expiresAt: string;
}

export interface AvatarCommandService {
  initialize(input: {
    clientUploadId: string;
    originalName: string;
    sourceMimeType: string;
    sourceByteSize: number;
  }): Promise<AvatarUploadAuthorization>;
  complete(uploadId: string): Promise<{
    profileId: string;
    avatarUrl?: string;
    avatarThumbnailUrl?: string;
    updatedAt: string;
  }>;
  cancel(uploadId: string): Promise<void>;
  remove(): Promise<void>;
  resolveUrls(profileIds: string[], variant?: "thumbnail" | "display"): Promise<AvatarUrlItem[]>;
}
