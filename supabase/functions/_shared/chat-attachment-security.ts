export const attachmentLimits = {
  imageSourceBytes: 25 * 1024 * 1024,
  documentSourceBytes: 10 * 1024 * 1024,
  normalizedImageBytes: 5 * 1024 * 1024,
  maxImagePixels: 25_000_000,
  ooxmlMaxEntries: 256,
  ooxmlMaxEntryBytes: 8 * 1024 * 1024,
  ooxmlMaxExpandedBytes: 32 * 1024 * 1024,
  ooxmlMaxCompressionRatio: 100,
} as const;

export type NormalizedImageInspection =
  | {
      ok: true;
      format: "jpeg" | "webp";
      width: number;
      height: number;
      animated: false;
    }
  | {
      ok: false;
      code: "invalid_image" | "unsafe_dimensions" | "animated_image";
    };

export type AttachmentKind = "image" | "file";

export type FileInspection =
  | { ok: true }
  | {
      ok: false;
      code:
        | "invalid_file"
        | "encrypted_archive"
        | "unsafe_archive"
        | "macro_not_allowed";
    };

export type ScanVerdict =
  | { verdict: "clean"; providerReference: string | null }
  | { verdict: "malicious"; providerReference: string | null }
  | { verdict: "unavailable"; reason: "not_configured" | "provider_unavailable" };

const fileExtensions: Readonly<Record<string, string>> = {
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export const attachmentSourceExtensions: Readonly<Record<string, readonly string[]>> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heif", "heic"],
  "image/avif": ["avif"],
  ...Object.fromEntries(
    Object.entries(fileExtensions).map(([mime, extension]) => [mime, [extension]]),
  ),
};

export function extensionForDocumentMime(mime: string): string | null {
  return fileExtensions[mime] ?? null;
}

export function kindForSourceMime(mime: string): AttachmentKind | null {
  if (mime in fileExtensions) return "file";
  if (mime in attachmentSourceExtensions && mime.startsWith("image/")) return "image";
  return null;
}

function truncateName(name: string, maxCodePoints = 180): string {
  const points = [...name];
  if (points.length <= maxCodePoints) return name;
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 && name.length - dot <= 12 ? name.slice(dot) : "";
  const available = Math.max(1, maxCodePoints - [...extension].length);
  return `${points.slice(0, available).join("")}${extension}`;
}

/** Display-only sanitization. Object paths are always generated identifiers. */
export function sanitizeAttachmentName(rawName: string, kind: AttachmentKind): string {
  if (kind === "image") return "Photo";
  let normalized: string;
  try {
    normalized = rawName.normalize("NFKC");
  } catch {
    normalized = rawName;
  }
  const basename = normalized.replaceAll("\\", "/").split("/").pop() ?? "";
  const safe = basename
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!safe || safe === "." || safe === "..") return "File";
  return truncateName(safe);
}

export function sourceNameMatchesMime(name: string, mime: string): boolean {
  const expected = attachmentSourceExtensions[mime];
  if (!expected) return false;
  if (mime.startsWith("image/")) return true;
  const extension = name.replaceAll("\\", "/").split("/").pop()?.split(".").pop()?.toLowerCase();
  return Boolean(extension && expected.includes(extension));
}

export function isValidSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function safeImageDimensions(width: number, height: number): boolean {
  return Number.isSafeInteger(width)
    && Number.isSafeInteger(height)
    && width >= 1
    && height >= 1
    && width <= 4096
    && height <= 4096
    && width * height <= attachmentLimits.maxImagePixels;
}

function readBigEndianUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function inspectJpeg(bytes: Uint8Array): NormalizedImageInspection {
  if (
    bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8
    || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9
  ) {
    return { ok: false, code: "invalid_image" };
  }
  let offset = 2;
  let dimensions: { width: number; height: number } | null = null;
  let foundScan = false;
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 0xff) return { ok: false, code: "invalid_image" };
    while (bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return { ok: false, code: "invalid_image" };
    const marker = bytes[offset++]!;
    if (marker === 0xda) {
      foundScan = true;
      break;
    }
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) return { ok: false, code: "invalid_image" };
    const segmentLength = readBigEndianUint16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length - 2) {
      return { ok: false, code: "invalid_image" };
    }
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 8 || dimensions) return { ok: false, code: "invalid_image" };
      const height = readBigEndianUint16(bytes, offset + 3);
      const width = readBigEndianUint16(bytes, offset + 5);
      dimensions = { width, height };
    }
    offset += segmentLength;
  }
  if (!foundScan || !dimensions) return { ok: false, code: "invalid_image" };
  if (!safeImageDimensions(dimensions.width, dimensions.height)) {
    return { ok: false, code: "unsafe_dimensions" };
  }
  return { ok: true, format: "jpeg", ...dimensions, animated: false };
}

function readUint24(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function inspectWebp(bytes: Uint8Array): NormalizedImageInspection {
  if (
    bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP"
    || readUint32(bytes, 4) + 8 !== bytes.length
  ) {
    return { ok: false, code: "invalid_image" };
  }
  let offset = 12;
  let canvas: { width: number; height: number } | null = null;
  let payload: { width: number; height: number } | null = null;
  let imageChunks = 0;
  let animated = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return { ok: false, code: "invalid_image" };
    const chunk = ascii(bytes, offset, 4);
    const chunkSize = readUint32(bytes, offset + 4);
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + chunkSize + (chunkSize & 1);
    if (nextOffset > bytes.length) return { ok: false, code: "invalid_image" };
    if (chunk === "VP8X") {
      if (chunkSize !== 10 || canvas) return { ok: false, code: "invalid_image" };
      animated ||= (bytes[dataOffset]! & 0x02) !== 0;
      canvas = {
        width: readUint24(bytes, dataOffset + 4) + 1,
        height: readUint24(bytes, dataOffset + 7) + 1,
      };
    } else if (chunk === "VP8 ") {
      if (
        chunkSize < 10 || ascii(bytes, dataOffset + 3, 3) !== "\x9d\x01\x2a"
      ) return { ok: false, code: "invalid_image" };
      imageChunks += 1;
      payload = {
        width: readUint16(bytes, dataOffset + 6) & 0x3fff,
        height: readUint16(bytes, dataOffset + 8) & 0x3fff,
      };
    } else if (chunk === "VP8L") {
      if (chunkSize < 5 || bytes[dataOffset] !== 0x2f) {
        return { ok: false, code: "invalid_image" };
      }
      imageChunks += 1;
      const packed = readUint32(bytes, dataOffset + 1);
      if ((packed >>> 29) !== 0) return { ok: false, code: "invalid_image" };
      payload = {
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
    } else if (chunk === "ANIM" || chunk === "ANMF") {
      animated = true;
    }
    offset = nextOffset;
  }
  if (offset !== bytes.length || imageChunks !== 1 || !payload) {
    return { ok: false, code: "invalid_image" };
  }
  if (animated) return { ok: false, code: "animated_image" };
  const dimensions = canvas ?? payload;
  if (canvas && (payload.width > canvas.width || payload.height > canvas.height)) {
    return { ok: false, code: "invalid_image" };
  }
  if (!safeImageDimensions(dimensions.width, dimensions.height)) {
    return { ok: false, code: "unsafe_dimensions" };
  }
  return { ok: true, format: "webp", ...dimensions, animated: false };
}

/** Inspect dimensions and animation before passing untrusted bytes to a decoder. */
export function inspectNormalizedImage(bytes: Uint8Array): NormalizedImageInspection {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return inspectJpeg(bytes);
  if (ascii(bytes, 0, Math.min(4, bytes.length)) === "RIFF") return inspectWebp(bytes);
  return { ok: false, code: "invalid_image" };
}

/** JPEG is an iOS-only staging representation; WebP remains the web input. */
export function isSupportedNormalizedImage(bytes: Uint8Array): boolean {
  return inspectNormalizedImage(bytes).ok;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]!
    | (bytes[offset + 1]! << 8)
    | (bytes[offset + 2]! << 16)
    | (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (readUint32(bytes, offset) === 0x06054b50) return offset;
  }
  return -1;
}

const crc32Table = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function updateCrc32(state: number, bytes: Uint8Array): number {
  let crc = state;
  for (const byte of bytes) crc = crc32Table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return crc >>> 0;
}

async function verifyZipPayload(input: {
  payload: Uint8Array;
  method: number;
  expandedSize: number;
  crc32: number;
}): Promise<FileInspection> {
  let expandedBytes = 0;
  let crcState = 0xffffffff;
  const acceptChunk = (chunk: Uint8Array): FileInspection | null => {
    expandedBytes += chunk.length;
    if (
      expandedBytes > input.expandedSize
      || expandedBytes > attachmentLimits.ooxmlMaxEntryBytes
    ) return { ok: false, code: "unsafe_archive" };
    crcState = updateCrc32(crcState, chunk);
    return null;
  };

  try {
    if (input.method === 0) {
      const rejected = acceptChunk(input.payload);
      if (rejected) return rejected;
    } else {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(input.payload);
          controller.close();
        },
      });
      const inflated = source.pipeThrough(
        new DecompressionStream("deflate-raw" as CompressionFormat),
      );
      const reader = inflated.getReader();
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        const rejected = acceptChunk(result.value);
        if (rejected) {
          await reader.cancel();
          return rejected;
        }
      }
    }
  } catch {
    return { ok: false, code: "invalid_file" };
  }
  if (expandedBytes !== input.expandedSize || (crcState ^ 0xffffffff) >>> 0 !== input.crc32) {
    return { ok: false, code: "invalid_file" };
  }
  return { ok: true };
}

async function inspectOoxml(bytes: Uint8Array, mime: string): Promise<FileInspection> {
  if (bytes.length < 22 || readUint32(bytes, 0) !== 0x04034b50) {
    return { ok: false, code: "invalid_file" };
  }
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) return { ok: false, code: "invalid_file" };
  const diskNumber = readUint16(bytes, eocd + 4);
  const centralDisk = readUint16(bytes, eocd + 6);
  const entriesOnDisk = readUint16(bytes, eocd + 8);
  const entryCount = readUint16(bytes, eocd + 10);
  const centralSize = readUint32(bytes, eocd + 12);
  const centralOffset = readUint32(bytes, eocd + 16);
  const commentLength = readUint16(bytes, eocd + 20);
  if (
    diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount
    || entryCount < 1 || entryCount > attachmentLimits.ooxmlMaxEntries
    || centralSize > 2 * 1024 * 1024
    || centralOffset + centralSize !== eocd
    || eocd + 22 + commentLength !== bytes.length
  ) {
    return { ok: false, code: "unsafe_archive" };
  }

  const expectedRoot = mime.includes("wordprocessingml")
    ? "word/"
    : mime.includes("spreadsheetml")
    ? "xl/"
    : mime.includes("presentationml")
    ? "ppt/"
    : null;
  if (!expectedRoot) return { ok: false, code: "invalid_file" };

  let offset = centralOffset;
  let expandedBytes = 0;
  let hasContentTypes = false;
  let hasExpectedRoot = false;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const localExtents: Array<{ start: number; end: number }> = [];
  const payloads: Array<{
    payload: Uint8Array;
    method: number;
    expandedSize: number;
    crc32: number;
  }> = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocd || readUint32(bytes, offset) !== 0x02014b50) {
      return { ok: false, code: "invalid_file" };
    }
    const flags = readUint16(bytes, offset + 8);
    const method = readUint16(bytes, offset + 10);
    const crc32 = readUint32(bytes, offset + 16);
    const compressedSize = readUint32(bytes, offset + 20);
    const expandedSize = readUint32(bytes, offset + 24);
    const nameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const entryDisk = readUint16(bytes, offset + 34);
    const localOffset = readUint32(bytes, offset + 42);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (
      nextOffset > eocd || nameLength < 1 || nameLength > 512 || entryDisk !== 0
      || localOffset >= centralOffset || localOffset + 30 > centralOffset
    ) {
      return { ok: false, code: "unsafe_archive" };
    }
    if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) {
      return { ok: false, code: "encrypted_archive" };
    }
    if ((method !== 0 && method !== 8) || compressedSize === 0xffffffff || expandedSize === 0xffffffff) {
      return { ok: false, code: "unsafe_archive" };
    }
    if (expandedSize > attachmentLimits.ooxmlMaxEntryBytes) {
      return { ok: false, code: "unsafe_archive" };
    }
    expandedBytes += expandedSize;
    if (expandedBytes > attachmentLimits.ooxmlMaxExpandedBytes) {
      return { ok: false, code: "unsafe_archive" };
    }
    if (
      expandedSize > 0
      && (compressedSize === 0 || expandedSize / compressedSize > attachmentLimits.ooxmlMaxCompressionRatio)
    ) {
      return { ok: false, code: "unsafe_archive" };
    }

    let name: string;
    try {
      name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    } catch {
      return { ok: false, code: "invalid_file" };
    }
    const lowerName = name.toLowerCase();
    if (
      name.startsWith("/") || name.startsWith("\\") || name.includes("\\")
      || name.split("/").some((part) => part === "..")
    ) {
      return { ok: false, code: "unsafe_archive" };
    }
    if (/\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(name)) {
      return { ok: false, code: "unsafe_archive" };
    }
    if (/(^|\/)vbaproject\.bin$/i.test(name) || lowerName.includes("/activex/")) {
      return { ok: false, code: "macro_not_allowed" };
    }

    if (readUint32(bytes, localOffset) !== 0x04034b50) {
      return { ok: false, code: "invalid_file" };
    }
    const localFlags = readUint16(bytes, localOffset + 6);
    const localMethod = readUint16(bytes, localOffset + 8);
    const localCrc32 = readUint32(bytes, localOffset + 14);
    const localCompressedSize = readUint32(bytes, localOffset + 18);
    const localExpandedSize = readUint32(bytes, localOffset + 22);
    const localNameLength = readUint16(bytes, localOffset + 26);
    const localExtraLength = readUint16(bytes, localOffset + 28);
    const localNameStart = localOffset + 30;
    const payloadStart = localNameStart + localNameLength + localExtraLength;
    const payloadEnd = payloadStart + compressedSize;
    if (
      localFlags !== flags || localMethod !== method || localNameLength !== nameLength
      || payloadStart > centralOffset || payloadEnd > centralOffset
    ) {
      return { ok: false, code: "invalid_file" };
    }
    const centralName = bytes.slice(offset + 46, offset + 46 + nameLength);
    const localName = bytes.slice(localNameStart, localNameStart + localNameLength);
    if (centralName.length !== localName.length || centralName.some((byte, position) => byte !== localName[position])) {
      return { ok: false, code: "invalid_file" };
    }

    const hasDescriptor = (flags & 0x0008) !== 0;
    let localEnd = payloadEnd;
    if (!hasDescriptor) {
      if (
        localCrc32 !== crc32 || localCompressedSize !== compressedSize
        || localExpandedSize !== expandedSize
      ) return { ok: false, code: "invalid_file" };
    } else {
      if (
        (localCrc32 !== 0 && localCrc32 !== crc32)
        || (localCompressedSize !== 0 && localCompressedSize !== compressedSize)
        || (localExpandedSize !== 0 && localExpandedSize !== expandedSize)
      ) return { ok: false, code: "invalid_file" };
      const signedDescriptor = readUint32(bytes, payloadEnd) === 0x08074b50
        && readUint32(bytes, payloadEnd + 4) === crc32
        && readUint32(bytes, payloadEnd + 8) === compressedSize
        && readUint32(bytes, payloadEnd + 12) === expandedSize;
      const descriptorOffset = signedDescriptor ? payloadEnd + 4 : payloadEnd;
      localEnd = descriptorOffset + 12;
      if (
        localEnd > centralOffset || readUint32(bytes, descriptorOffset) !== crc32
        || readUint32(bytes, descriptorOffset + 4) !== compressedSize
        || readUint32(bytes, descriptorOffset + 8) !== expandedSize
      ) return { ok: false, code: "invalid_file" };
    }
    localExtents.push({ start: localOffset, end: localEnd });
    payloads.push({
      payload: bytes.slice(payloadStart, payloadEnd),
      method,
      expandedSize,
      crc32,
    });
    hasContentTypes ||= name === "[Content_Types].xml";
    hasExpectedRoot ||= name.startsWith(expectedRoot) && !name.endsWith("/");
    offset = nextOffset;
  }
  if (offset !== centralOffset + centralSize || !hasContentTypes || !hasExpectedRoot) {
    return { ok: false, code: "invalid_file" };
  }
  localExtents.sort((left, right) => left.start - right.start);
  for (let index = 1; index < localExtents.length; index += 1) {
    if (localExtents[index]!.start < localExtents[index - 1]!.end) {
      return { ok: false, code: "invalid_file" };
    }
  }
  for (const payload of payloads) {
    const inspection = await verifyZipPayload(payload);
    if (!inspection.ok) return inspection;
  }
  return { ok: true };
}

export async function inspectDocument(bytes: Uint8Array, mime: string): Promise<FileInspection> {
  if (mime === "audio/mp4") return inspectAudioMp4(bytes);
  if (mime === "application/pdf") {
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    const tail = new TextDecoder().decode(bytes.slice(Math.max(0, bytes.length - 2048)));
    return bytes.length >= 12 && /^%PDF-1\.[0-7]/.test(header) && tail.includes("%%EOF")
      ? { ok: true }
      : { ok: false, code: "invalid_file" };
  }
  if (mime === "text/plain" || mime === "text/csv") {
    if (bytes.length < 1 || bytes.includes(0)) return { ok: false, code: "invalid_file" };
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return { ok: true };
    } catch {
      return { ok: false, code: "invalid_file" };
    }
  }
  return await inspectOoxml(bytes, mime);
}

function readBigEndianUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! * 0x1000000)
    + (bytes[offset + 1]! << 16)
    + (bytes[offset + 2]! << 8)
    + bytes[offset + 3]!) >>> 0;
}

function inspectAudioMp4(bytes: Uint8Array): FileInspection {
  let offset = 0;
  let hasFileType = false;
  let hasMovie = false;
  let hasMediaData = false;
  let boxCount = 0;

  while (offset < bytes.length) {
    if (bytes.length - offset < 8 || boxCount++ > 256) {
      return { ok: false, code: "invalid_file" };
    }
    const declaredSize = readBigEndianUint32(bytes, offset);
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    let headerSize = 8;
    let boxSize = declaredSize;
    if (declaredSize === 1) {
      if (bytes.length - offset < 16) return { ok: false, code: "invalid_file" };
      const high = readBigEndianUint32(bytes, offset + 8);
      const low = readBigEndianUint32(bytes, offset + 12);
      if (high !== 0) return { ok: false, code: "invalid_file" };
      boxSize = low;
      headerSize = 16;
    } else if (declaredSize === 0) {
      boxSize = bytes.length - offset;
    }
    if (boxSize < headerSize || boxSize > bytes.length - offset) {
      return { ok: false, code: "invalid_file" };
    }
    if (type === "ftyp") {
      if (boxSize < headerSize + 8) return { ok: false, code: "invalid_file" };
      hasFileType = true;
    } else if (type === "moov" && boxSize > headerSize) {
      hasMovie = true;
    } else if (type === "mdat" && boxSize > headerSize) {
      hasMediaData = true;
    }
    offset += boxSize;
  }

  return hasFileType && hasMovie && hasMediaData
    ? { ok: true }
    : { ok: false, code: "invalid_file" };
}

export async function scanDocument(input: {
  bytes: Uint8Array;
  mimeType: string;
  sha256: string;
  scannerUrl?: string | null;
  scannerToken?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ScanVerdict> {
  const scannerUrl = input.scannerUrl?.trim();
  const scannerToken = input.scannerToken?.trim();
  if (!scannerUrl || !scannerToken) {
    return { verdict: "unavailable", reason: "not_configured" };
  }
  let endpoint: URL;
  try {
    endpoint = new URL(scannerUrl);
  } catch {
    return { verdict: "unavailable", reason: "not_configured" };
  }
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") {
    return { verdict: "unavailable", reason: "not_configured" };
  }

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), input.timeoutMs ?? 20_000);
  try {
    const response = await (input.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${scannerToken}`,
        "content-type": input.mimeType,
        "x-content-sha256": input.sha256,
      },
      body: input.bytes,
      signal: abort.signal,
    });
    if (!response.ok) return { verdict: "unavailable", reason: "provider_unavailable" };
    const text = await response.text();
    if (text.length > 8192) return { verdict: "unavailable", reason: "provider_unavailable" };
    const payload = JSON.parse(text) as { verdict?: unknown; reference?: unknown };
    const providerReference = typeof payload.reference === "string"
      ? payload.reference.slice(0, 200)
      : null;
    if (payload.verdict === "clean") return { verdict: "clean", providerReference };
    if (payload.verdict === "malicious") return { verdict: "malicious", providerReference };
    return { verdict: "unavailable", reason: "provider_unavailable" };
  } catch {
    return { verdict: "unavailable", reason: "provider_unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
