import type {
  SharedContentClassification,
  SharedContentSourceDescriptor,
} from "./types.ts";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function isCanonicalSafeLink(source: SharedContentSourceDescriptor): boolean {
  if (
    !source.itemId.startsWith("link:") ||
    source.linkUrl === undefined ||
    source.linkHostname === undefined
  ) {
    return false;
  }

  try {
    const url = new URL(source.linkUrl);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      url.hash === "" &&
      url.hostname === source.linkHostname
    );
  } catch {
    return false;
  }
}

function isReadyBoundAttachment(source: SharedContentSourceDescriptor): boolean {
  return (
    source.sourceKind === "attachment" &&
    source.attachmentStatus === "ready" &&
    source.boundToSource === true &&
    source.sourceDeleted === false &&
    source.itemId.startsWith("attachment:") &&
    typeof source.attachmentId === "string" &&
    typeof source.displayPath === "string"
  );
}

/**
 * Classify only normalized server descriptors. This proves client parity; it
 * is not an authorization check and must never replace the server RPC/RLS.
 */
export function classifySharedContentSource(
  source: SharedContentSourceDescriptor,
  conversationId?: string,
): SharedContentClassification | null {
  if (
    source.sourceDeleted ||
    (conversationId !== undefined && source.conversationId !== conversationId)
  ) {
    return null;
  }

  if (isReadyBoundAttachment(source)) {
    if (
      source.attachmentKind === "image" &&
      source.storedMimeType === "image/webp"
    ) {
      return { category: "media", kind: "photo" };
    }

    if (source.attachmentKind === "file") {
      if (source.storedMimeType === "video/mp4") {
        return { category: "media", kind: "video" };
      }
      if (source.storedMimeType === "audio/mp4") {
        return { category: "voice", kind: "voice" };
      }
      if (DOCUMENT_MIME_TYPES.has(source.storedMimeType ?? "")) {
        return { category: "files", kind: "document" };
      }
    }

    return null;
  }

  if (source.sourceKind === "gif") {
    return source.itemId.startsWith("gif:") &&
      source.gifProvider !== undefined &&
      source.gifProviderContentId !== undefined
      ? { category: "media", kind: "gif" }
      : null;
  }

  if (source.sourceKind === "sticker") {
    return source.itemId.startsWith("sticker:") &&
      source.stickerId !== undefined &&
      source.stickerId.length > 0
      ? { category: "media", kind: "sticker" }
      : null;
  }

  if (source.sourceKind === "link") {
    return isCanonicalSafeLink(source)
      ? { category: "links", kind: "link" }
      : null;
  }

  return null;
}
