import type { Options } from "browser-image-compression";

export function chatImageCompressionOptions(
  onProgress: (progress: number) => void
): Options {
  return {
    // Keep uploads small before they cross the network. The Edge Function
    // independently re-encodes again, so this is an efficiency layer rather
    // than the security boundary.
    maxSizeMB: 2,
    maxWidthOrHeight: 2560,
    // A module worker owned by the app runs this compression. Keep the
    // library's CDN-backed worker disabled in both worker and fallback paths.
    useWebWorker: false,
    fileType: "image/webp",
    initialQuality: 0.8,
    preserveExif: false,
    onProgress,
  };
}
