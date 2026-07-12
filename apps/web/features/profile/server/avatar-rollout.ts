import "server-only";

export function avatarUploadsEnabled(): boolean {
  return process.env.AVATAR_UPLOADS_ENABLED?.trim().toLowerCase() === "true";
}
