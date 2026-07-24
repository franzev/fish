import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";

const maximumUrlLength = 2_048;
const safeLinkValidationVersion = 2;
const previewFetchDisabled = "preview_fetch_disabled";

export type LinkPreviewMetadata = {
  url: string;
  hostname: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
};

export type HostAddressRecordType = "A" | "AAAA";
export type HostAddressResolver = (
  hostname: string,
  recordType: HostAddressRecordType,
) => Promise<readonly string[]>;

const productionHostAddressResolver: HostAddressResolver = async (hostname, recordType) => {
  try {
    return await Deno.resolveDns(hostname, recordType);
  } catch (error) {
    if (isDnsNoRecordError(error)) return [];
    throw error;
  }
};

export function firstPublicHttpUrl(body: string): string | null {
  const matches = body.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const raw of matches) {
    const candidate = raw.replace(/[),.!?:;]+$/g, "");
    const checked = validatePublicUrl(candidate);
    if (checked) return checked.toString();
  }
  return null;
}

export async function firstSafePublicHttpUrl(
  body: string,
  resolver: HostAddressResolver = productionHostAddressResolver,
): Promise<string | null> {
  const matches = body.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const raw of matches) {
    const candidate = raw.replace(/[),.!?:;]+$/g, "");
    const checked = validatePublicUrl(candidate);
    if (!checked) continue;
    if (await resolvePublicHostAddresses(checked.hostname, resolver)) {
      return checked.toString();
    }
  }
  return null;
}

export function validatePublicUrl(value: string): URL | null {
  if (value.length === 0 || value.length > maximumUrlLength) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  if (isPrivateHostname(url.hostname)) return null;
  url.hash = "";
  return url;
}

export async function resolvePublicHostAddresses(
  hostname: string,
  resolver: HostAddressResolver = productionHostAddressResolver,
): Promise<string[] | null> {
  const literal = normalizeAddress(hostname);
  if (literal && isPublicAddress(literal)) return [literal];

  let answers: readonly string[];
  try {
    const resolved = await Promise.all([
      resolver(hostname, "A"),
      resolver(hostname, "AAAA"),
    ]);
    answers = [...resolved[0], ...resolved[1]];
  } catch {
    return null;
  }

  if (answers.length === 0) return null;
  const normalized = answers.map(normalizeAddress);
  if (normalized.some((address) => address === null)) return null;
  const addresses = [...new Set(normalized as string[])].sort((left, right) => left.localeCompare(right, "en", { numeric: false }));
  if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) return null;
  return addresses;
}

export async function persistCanonicalLinkIdentity(
  admin: SupabaseClient,
  messageId: string,
  validatedUrl: string,
): Promise<boolean> {
  const url = validatePublicUrl(validatedUrl);
  if (!url) return false;
  const { error } = await admin.from("message_link_previews").upsert({
    message_id: messageId,
    url: url.toString(),
    hostname: url.hostname,
    safe_link_validation_version: safeLinkValidationVersion,
    safe_link_validated_at: new Date().toISOString(),
  }, { onConflict: "message_id", ignoreDuplicates: true });
  return !error;
}

export async function enqueueLinkPreviewJob(
  admin: SupabaseClient,
  messageId: string,
  body: string,
  resolver: HostAddressResolver = productionHostAddressResolver,
): Promise<boolean> {
  const url = await firstSafePublicHttpUrl(body, resolver);
  if (!url) return false;
  return persistCanonicalLinkIdentity(admin, messageId, url);
}

export async function processLinkPreviewJobs(
  admin: SupabaseClient,
  limit = 8,
): Promise<void> {
  const { data: jobs } = await admin.from("chat_link_preview_jobs")
    .select("message_id")
    .in("state", ["pending", "processing"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(Math.max(0, Math.min(limit, 8)));

  for (const job of jobs ?? []) {
    await admin.from("chat_link_preview_jobs")
      .update({
        state: "failed",
        last_error: previewFetchDisabled,
        updated_at: new Date().toISOString(),
      })
      .eq("message_id", job.message_id)
      .in("state", ["pending", "processing"])
      .select("message_id");
  }
}

function isDnsNoRecordError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "NotFound" || candidate.name === "DnsNotFound" || candidate.code === "ENODATA";
}

function normalizeAddress(value: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^\[|\]$/g, "");
  const ipv4 = parseIpv4(trimmed);
  if (ipv4) return ipv4.join(".");
  const ipv6 = parseIpv6(trimmed);
  return ipv6 ? formatIpv6(ipv6) : null;
}

function isPublicAddress(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (ipv4) return isPublicIpv4(ipv4);
  const ipv6 = parseIpv6(address);
  return ipv6 !== null && isPublicIpv6(ipv6);
}

function parseIpv4(value: string): number[] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return null;
  const octets = value.split(".").map(Number);
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
}

function isPublicIpv4([a, b, c, d]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a === 255 && b === 255 && c === 255 && d === 255) return false;
  return true;
}

function parseIpv6(value: string): number[] | null {
  if (!value.includes(":")) return null;
  if (value.includes("%")) return null;
  let source = value.toLowerCase();
  if (source.includes(".")) {
    const separator = source.lastIndexOf(":");
    if (separator < 0) return null;
    const ipv4 = parseIpv4(source.slice(separator + 1));
    if (!ipv4) return null;
    source = `${source.slice(0, separator)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }

  const halves = source.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  const values = [...left, ...right].map((part) => Number.parseInt(part, 16));
  if (halves.length === 1) return values.length === 8 ? values : null;
  const missing = 8 - values.length;
  return missing > 0 ? [...left.map((part) => Number.parseInt(part, 16)), ...Array(missing).fill(0), ...right.map((part) => Number.parseInt(part, 16))] : null;
}

function formatIpv6(groups: number[]): string {
  const parts = groups.map((group) => group.toString(16).padStart(4, "0"));
  let bestStart = -1;
  let bestLength = 1;
  for (let start = 0; start < groups.length;) {
    if (groups[start] !== 0) {
      start += 1;
      continue;
    }
    let end = start;
    while (end < groups.length && groups[end] === 0) end += 1;
    if (end - start > bestLength) {
      bestStart = start;
      bestLength = end - start;
    }
    start = end;
  }
  if (bestStart < 0) return parts.join(":");
  const left = parts.slice(0, bestStart).join(":");
  const right = parts.slice(bestStart + bestLength).join(":");
  return `${left}::${right}`.replace(/^:::|:::$/g, "::");
}

function isPublicIpv6(groups: number[]): boolean {
  const [first, second] = groups;
  if (first === 0) return false;
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (first === 0x2001 && (second === 0x0db8 || second === 0x0000 || second === 0x0010 || second === 0x0020)) return false;
  return true;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/[.]$/, "").replace(/^\[|\]$/g, "");
  if (
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host.endsWith(".internal") || host === "0.0.0.0" || host === "::1"
  ) return true;
  // Literal IPv6 hosts are resolved as hostnames only after URL syntax has
  // accepted them; reject them here because the canonical path requires DNS.
  if (host.includes(":")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127 || a >= 224;
  }
  return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
}
