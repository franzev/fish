import type { ClientChatImage } from "@/lib/services";

export type AttachmentRun =
  | { kind: "images"; items: ClientChatImage[] }
  | { kind: "file"; item: ClientChatImage };

export function attachmentRuns(attachments: ClientChatImage[]): AttachmentRun[] {
  const runs: AttachmentRun[] = [];
  let images: ClientChatImage[] = [];
  const flushImages = () => {
    if (images.length > 0) runs.push({ kind: "images", items: images });
    images = [];
  };
  for (const attachment of attachments) {
    if (attachment.kind === "file") {
      flushImages();
      runs.push({ kind: "file", item: attachment });
    } else {
      images.push(attachment);
    }
  }
  flushImages();
  return runs;
}

export function fileTypeLabel(mimeType = "application/octet-stream"): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/plain") return "Text file";
  if (mimeType === "text/csv") return "CSV";
  if (mimeType.includes("wordprocessingml")) return "Word document";
  if (mimeType.includes("spreadsheetml")) return "Excel workbook";
  if (mimeType.includes("presentationml")) return "PowerPoint presentation";
  return "File";
}

export function formatFileSize(bytes = 0): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
