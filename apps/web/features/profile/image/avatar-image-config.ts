export const avatarFileTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const avatarSourceMaxBytes = 10 * 1024 * 1024;
export const avatarPreparedMaxBytes = 1024 * 1024;
export const avatarMinEdge = 128;
export const avatarMaxEdge = 8192;
export const avatarMaxPixels = 25_000_000;

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}
