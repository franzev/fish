import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectNormalizedImage,
  inspectDocument,
  isSupportedNormalizedImage,
  isValidSha256,
  sanitizeAttachmentName,
  scanDocument,
  sha256Hex,
} from "./chat-attachment-security.ts";

type ZipEntry = {
  name: string;
  data?: string | Uint8Array;
  flags?: number;
  method?: 0 | 8;
  descriptor?: boolean;
  declaredCompressedSize?: number;
  declaredExpandedSize?: number;
  declaredCrc32?: number;
  payloadOverride?: Uint8Array;
};

function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const compressed = source.pipeThrough(
    new CompressionStream("deflate-raw" as CompressionFormat),
  );
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

async function makeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const locals: number[] = [];
  const central: number[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = [...encoder.encode(entry.name)];
    const data = typeof entry.data === "string"
      ? encoder.encode(entry.data)
      : entry.data ?? encoder.encode("<xml />");
    const method = entry.method ?? 0;
    const compressed = method === 8 ? await deflateRaw(data) : data;
    const payload = entry.payloadOverride ?? compressed;
    const compressedSize = entry.declaredCompressedSize ?? compressed.length;
    const expandedSize = entry.declaredExpandedSize ?? data.length;
    const flags = (entry.flags ?? 0x0800) | (entry.descriptor ? 0x0008 : 0);
    const crc = entry.declaredCrc32 ?? crc32(data);
    locals.push(
      ...u32(0x04034b50), ...u16(20), ...u16(flags), ...u16(method),
      ...u16(0), ...u16(0), ...u32(entry.descriptor ? 0 : crc),
      ...u32(entry.descriptor ? 0 : compressedSize), ...u32(entry.descriptor ? 0 : expandedSize),
      ...u16(name.length), ...u16(0), ...name, ...payload,
    );
    if (entry.descriptor) {
      locals.push(...u32(0x08074b50), ...u32(crc), ...u32(compressedSize), ...u32(expandedSize));
    }
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flags), ...u16(method),
      ...u16(0), ...u16(0), ...u32(crc), ...u32(compressedSize), ...u32(expandedSize),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(localOffset), ...name,
    );
    localOffset = locals.length;
  }
  const centralOffset = locals.length;
  const end = [
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(central.length), ...u32(centralOffset), ...u16(0),
  ];
  return Uint8Array.from([...locals, ...central, ...end]);
}

function findSignature(bytes: Uint8Array, signature: number): number {
  for (let offset = 0; offset <= bytes.length - 4; offset += 1) {
    if (
      bytes[offset] === (signature & 0xff)
      && bytes[offset + 1] === ((signature >>> 8) & 0xff)
      && bytes[offset + 2] === ((signature >>> 16) & 0xff)
      && bytes[offset + 3] === ((signature >>> 24) & 0xff)
    ) return offset;
  }
  return -1;
}

const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function makeJpeg(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08, ...u16(height).reverse(), ...u16(width).reverse(),
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x00, 0xff, 0xd9,
  ]);
}

function makeLosslessWebp(width: number, height: number, animated = false): Uint8Array {
  const packed = (width - 1) | ((height - 1) << 14);
  const chunks: number[] = [];
  if (animated) {
    chunks.push(
      ...new TextEncoder().encode("VP8X"), ...u32(10), 0x02, 0, 0, 0,
      ...u32(width - 1).slice(0, 3), ...u32(height - 1).slice(0, 3),
    );
  }
  chunks.push(
    ...new TextEncoder().encode("VP8L"), ...u32(5), 0x2f, ...u32(packed), 0,
  );
  const riffSize = 4 + chunks.length;
  return Uint8Array.from([
    ...new TextEncoder().encode("RIFF"), ...u32(riffSize),
    ...new TextEncoder().encode("WEBP"), ...chunks,
  ]);
}

test("attachment names are neutral for photos and safe for documents", () => {
  assert.equal(sanitizeAttachmentName("IMG_1234.HEIC", "image"), "Photo");
  assert.equal(sanitizeAttachmentName("../private/\u202esecret\u0000 report.pdf", "file"), "secret report.pdf");
  assert.equal(sanitizeAttachmentName("..", "file"), "File");
  assert.ok([...sanitizeAttachmentName(`${"a".repeat(300)}.pdf`, "file")].length <= 180);
});

test("sha256 is deterministic and strictly validated", async () => {
  const hash = await sha256Hex(new TextEncoder().encode("fish"));
  assert.equal(hash, "b474a99a2705e23cf905a484ec6d14ef58b56bbe62e9292783466ec363b5072d");
  assert.equal(isValidSha256(hash), true);
  assert.equal(isValidSha256(hash.toUpperCase()), false);
  assert.equal(isValidSha256("abc"), false);
});

test("normalized image staging inspects dimensions before decode", () => {
  assert.deepEqual(inspectNormalizedImage(makeJpeg(320, 240)), {
    ok: true, format: "jpeg", width: 320, height: 240, animated: false,
  });
  assert.deepEqual(inspectNormalizedImage(makeLosslessWebp(64, 48)), {
    ok: true, format: "webp", width: 64, height: 48, animated: false,
  });
  assert.equal(isSupportedNormalizedImage(makeJpeg(320, 240)), true);
  assert.equal(isSupportedNormalizedImage(Uint8Array.of(0xff, 0xd8)), false);
  assert.equal(isSupportedNormalizedImage(Uint8Array.of(0x89, 0x50, 0x4e, 0x47)), false);
});

test("normalized image inspection rejects bombs, animation, and truncation", () => {
  assert.deepEqual(inspectNormalizedImage(makeJpeg(65535, 4096)), {
    ok: false, code: "unsafe_dimensions",
  });
  assert.deepEqual(inspectNormalizedImage(makeLosslessWebp(32, 32, true)), {
    ok: false, code: "animated_image",
  });
  const truncated = makeLosslessWebp(32, 32).slice(0, -1);
  assert.deepEqual(inspectNormalizedImage(truncated), { ok: false, code: "invalid_image" });
});

test("PDF and UTF-8 validation rejects header-only, NUL, and invalid text", async () => {
  assert.deepEqual(await inspectDocument(new TextEncoder().encode("%PDF-1.7\n%%EOF"), "application/pdf"), { ok: true });
  assert.deepEqual(await inspectDocument(new TextEncoder().encode("%PDF-1.7"), "application/pdf"), { ok: false, code: "invalid_file" });
  assert.deepEqual(await inspectDocument(Uint8Array.of(0x66, 0x00), "text/plain"), { ok: false, code: "invalid_file" });
  assert.deepEqual(await inspectDocument(Uint8Array.of(0xc3, 0x28), "text/csv"), { ok: false, code: "invalid_file" });
});

test("bounded OOXML accepts real stored, deflated, and descriptor entries", async () => {
  const bytes = await makeZip([
    { name: "[Content_Types].xml", data: "<Types />" },
    { name: "word/document.xml", data: "<document>Hello</document>", method: 8 },
  ]);
  assert.deepEqual(await inspectDocument(bytes, docxMime), { ok: true });
  assert.deepEqual(await inspectDocument(await makeZip([
    { name: "[Content_Types].xml", data: "<Types />", descriptor: true },
    { name: "word/document.xml", data: "<document />", method: 8, descriptor: true },
  ]), docxMime), { ok: true });
});

test("bounded OOXML rejects forged central/local metadata and truncated payloads", async () => {
  const entries = [
    { name: "[Content_Types].xml", data: "type" },
    { name: "word/document.xml", data: "body" },
  ];
  const mutations: Array<(bytes: Uint8Array) => void> = [
    (bytes) => { bytes[6] ^= 0x02; },
    (bytes) => { bytes[8] = 8; },
    (bytes) => { bytes[18] = 3; },
    (bytes) => { bytes[30] = "x".charCodeAt(0); },
  ];
  for (const mutate of mutations) {
    const forged = await makeZip(entries);
    mutate(forged);
    assert.deepEqual(await inspectDocument(forged, docxMime), { ok: false, code: "invalid_file" });
  }
  assert.deepEqual(
    await inspectDocument(await makeZip([
      { name: "[Content_Types].xml" },
      {
        name: "word/document.xml",
        data: "payload",
        declaredCompressedSize: 64,
        payloadOverride: Uint8Array.of(1),
      },
    ]), docxMime),
    { ok: false, code: "invalid_file" },
  );
  const forgedDescriptor = await makeZip([
    { name: "[Content_Types].xml", descriptor: true },
    { name: "word/document.xml", descriptor: true },
  ]);
  const descriptor = findSignature(forgedDescriptor, 0x08074b50);
  assert.ok(descriptor > 0);
  forgedDescriptor[descriptor + 8] ^= 0x01;
  assert.deepEqual(await inspectDocument(forgedDescriptor, docxMime), { ok: false, code: "invalid_file" });
});

test("bounded OOXML verifies actual expansion and CRC32", async () => {
  const contentTypes = { name: "[Content_Types].xml", data: "<Types />" };
  const forgedExpansion = await makeZip([
    contentTypes,
    {
      name: "word/document.xml",
      data: "A".repeat(2_000),
      method: 8,
      declaredExpandedSize: 1_000,
    },
  ]);
  assert.deepEqual(await inspectDocument(forgedExpansion, docxMime), {
    ok: false, code: "unsafe_archive",
  });
  const forgedCrc = await makeZip([
    contentTypes,
    { name: "word/document.xml", data: "<document />", method: 8, declaredCrc32: 7 },
  ]);
  assert.deepEqual(await inspectDocument(forgedCrc, docxMime), {
    ok: false, code: "invalid_file",
  });
});

test("bounded OOXML rejects traversal, nesting, encryption, macros, and bombs", async () => {
  const contentTypes = { name: "[Content_Types].xml" };
  for (const [entry, code] of [
    [{ name: "../word/document.xml" }, "unsafe_archive"],
    [{ name: "word/payload.zip" }, "unsafe_archive"],
    [{ name: "word/document.xml", flags: 0x0801 }, "encrypted_archive"],
    [{ name: "word/vbaProject.bin" }, "macro_not_allowed"],
    [{ name: "word/document.xml", declaredCompressedSize: 1, declaredExpandedSize: 1024 }, "unsafe_archive"],
    [{
      name: "word/document.xml",
      declaredCompressedSize: 90_000,
      declaredExpandedSize: 9 * 1024 * 1024,
    }, "unsafe_archive"],
  ] as const) {
    assert.deepEqual(await inspectDocument(await makeZip([contentTypes, entry]), docxMime), { ok: false, code });
  }
  assert.deepEqual(
    await inspectDocument(
      await makeZip(new Array(257).fill(null).map((_, index) => ({ name: `word/${index}.xml` }))),
      docxMime,
    ),
    { ok: false, code: "unsafe_archive" },
  );
});

test("scanner fails closed when unconfigured or unavailable", async () => {
  const bytes = new TextEncoder().encode("safe");
  assert.deepEqual(
    await scanDocument({ bytes, mimeType: "text/plain", sha256: "0".repeat(64) }),
    { verdict: "unavailable", reason: "not_configured" },
  );
  assert.deepEqual(
    await scanDocument({
      bytes,
      mimeType: "text/plain",
      sha256: "0".repeat(64),
      scannerUrl: "https://scanner.example.test/scan",
      scannerToken: "token",
      fetchImpl: async () => new Response("busy", { status: 503 }),
    }),
    { verdict: "unavailable", reason: "provider_unavailable" },
  );
});

test("scanner maps only explicit clean and malicious verdicts", async () => {
  const bytes = new TextEncoder().encode("safe");
  for (const verdict of ["clean", "malicious"] as const) {
    let requestHeaders: Headers | null = null;
    const result = await scanDocument({
      bytes,
      mimeType: "application/pdf",
      sha256: "a".repeat(64),
      scannerUrl: "https://scanner.example.test/scan",
      scannerToken: "token",
      fetchImpl: async (_input, init) => {
        requestHeaders = new Headers(init?.headers);
        return Response.json({ verdict, reference: "provider-123" });
      },
    });
    assert.deepEqual(result, { verdict, providerReference: "provider-123" });
    assert.equal(requestHeaders?.get("x-content-sha256"), "a".repeat(64));
    assert.equal(requestHeaders?.has("x-file-name"), false);
  }
});
