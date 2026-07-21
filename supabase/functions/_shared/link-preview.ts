import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";

const maximumUrlLength = 2_048;
const maximumHtmlBytes = 128 * 1_024;
const maximumRedirects = 3;

export type LinkPreviewMetadata = {
  url: string;
  hostname: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
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

export async function fetchLinkPreview(url: string): Promise<LinkPreviewMetadata> {
  const original = validatePublicUrl(url);
  if (!original) throw new Error("unsafe_url");
  let current = original;
  let response: Response | null = null;
  for (let redirect = 0; redirect <= maximumRedirects; redirect += 1) {
    response = await fetch(current, {
      redirect: "manual",
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9",
        range: `bytes=0-${maximumHtmlBytes - 1}`,
        "user-agent": "FISH-LinkPreview/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    const next = location ? validatePublicUrl(new URL(location, current).toString()) : null;
    if (!next) throw new Error("unsafe_redirect");
    current = next;
  }
  if (!response) throw new Error("fetch_failed");

  const hostname = current.hostname.toLowerCase();
  if (!response.ok || !/^text\/(html|xhtml)/i.test(response.headers.get("content-type") ?? "")) {
    return { url: original.toString(), hostname, title: null, description: null, siteName: null };
  }
  const html = await readLimited(response, maximumHtmlBytes);
  const title = metadata(html, "og:title") ?? htmlTitle(html);
  const description = metadata(html, "og:description") ?? metadata(html, "description");
  const siteName = metadata(html, "og:site_name");
  return {
    url: original.toString(),
    hostname,
    title: cleanText(title, 180),
    description: cleanText(description, 300),
    siteName: cleanText(siteName, 120),
  };
}

export async function enqueueLinkPreviewJob(
  admin: SupabaseClient,
  messageId: string,
  body: string,
): Promise<boolean> {
  const url = firstPublicHttpUrl(body);
  if (!url) return false;
  const { error } = await admin.from("chat_link_preview_jobs").upsert({
    message_id: messageId,
    url,
    state: "pending",
    attempt_count: 0,
    next_attempt_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "message_id" });
  return !error;
}

export async function processLinkPreviewJobs(
  admin: SupabaseClient,
  limit = 8,
): Promise<void> {
  const { data: jobs } = await admin.from("chat_link_preview_jobs")
    .select("message_id,url,attempt_count")
    .eq("state", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  for (const job of jobs ?? []) {
    const claimed = await admin.from("chat_link_preview_jobs")
      .update({ state: "processing", updated_at: new Date().toISOString() })
      .eq("message_id", job.message_id)
      .eq("state", "pending")
      .select("message_id");
    if (claimed.error || !claimed.data?.length) continue;
    try {
      const preview = await fetchLinkPreview(job.url);
      await admin.from("message_link_previews").upsert({
        message_id: job.message_id,
        url: preview.url,
        hostname: preview.hostname,
        title: preview.title,
        description: preview.description,
        site_name: preview.siteName,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "message_id" });
      await admin.from("chat_link_preview_jobs")
        .update({ state: "complete", updated_at: new Date().toISOString(), last_error: null })
        .eq("message_id", job.message_id);
    } catch (error) {
      const attempt = Number(job.attempt_count ?? 0) + 1;
      const delay = Math.min(3_600, 2 ** Math.min(attempt, 10) * 15);
      await admin.from("chat_link_preview_jobs")
        .update({
          state: attempt >= 6 ? "failed" : "pending",
          attempt_count: attempt,
          next_attempt_at: new Date(Date.now() + delay * 1_000).toISOString(),
          last_error: error instanceof Error ? error.message.slice(0, 120) : "preview_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("message_id", job.message_id);
    }
  }
}

async function readLimited(response: Response, maximum: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maximum) {
    const next = await reader.read();
    if (next.done) break;
    const chunk = next.value;
    const remaining = maximum - total;
    chunks.push(chunk.slice(0, remaining));
    total += Math.min(chunk.byteLength, remaining);
    if (chunk.byteLength > remaining) break;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function metadata(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\b[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  const reverse = new RegExp(
    `<meta\\b[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    "i",
  );
  return pattern.exec(html)?.[1] ?? reverse.exec(html)?.[1] ?? null;
}

function htmlTitle(html: string): string | null {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? null;
}

function cleanText(value: string | null, maximum: number): string | null {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maximum) : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/[.]$/, "").replace(/^\[|\]$/g, "");
  if (
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host.endsWith(".internal") || host === "0.0.0.0" || host === "::1"
  ) return true;
  // Edge Functions cannot reliably inspect DNS answers, so reject literal IPv6
  // hosts entirely. This blocks loopback, link-local, private, and IPv4-mapped
  // IPv6 forms that could otherwise bypass the IPv4 checks below.
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
