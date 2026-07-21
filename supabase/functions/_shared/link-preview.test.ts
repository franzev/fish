import assert from "node:assert/strict";
import test from "node:test";
import { fetchLinkPreview, firstPublicHttpUrl, validatePublicUrl } from "./link-preview.ts";

test("link extraction keeps the first public URL and strips punctuation", () => {
  assert.equal(
    firstPublicHttpUrl("Read https://example.com/article). Then stop."),
    "https://example.com/article",
  );
  assert.equal(firstPublicHttpUrl("http://127.0.0.1/admin"), null);
  assert.equal(firstPublicHttpUrl("http://[::ffff:127.0.0.1]/admin"), null);
  assert.equal(firstPublicHttpUrl("https://user:pass@example.com"), null);
});

test("URL validation rejects private networks and non-web schemes", () => {
  assert.equal(validatePublicUrl("http://localhost:3000"), null);
  assert.equal(validatePublicUrl("http://192.168.1.20"), null);
  assert.equal(validatePublicUrl("http://169.254.169.254/latest"), null);
  assert.equal(validatePublicUrl("http://100.64.0.1"), null);
  assert.equal(validatePublicUrl("http://224.0.0.1"), null);
  assert.equal(validatePublicUrl("https://example.com:8443/page"), null);
  assert.equal(validatePublicUrl("http://[2001:db8::1]/page"), null);
  assert.equal(validatePublicUrl("file:///etc/passwd"), null);
  assert.equal(validatePublicUrl("https://example.com")?.hostname, "example.com");
});

test("metadata fetch is bounded to HTML and follows only safe redirects", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Request[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init));
    return new Response(
      `<html><head><meta property="og:title" content="A calm title"><meta name="description" content="A useful description"></head></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  };
  try {
    const preview = await fetchLinkPreview("https://example.com/page");
    assert.equal(preview.hostname, "example.com");
    assert.equal(preview.title, "A calm title");
    assert.equal(preview.description, "A useful description");
    assert.equal(requests[0]?.headers.get("range"), "bytes=0-131071");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("metadata fetch rejects redirects into private address space", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, {
    status: 302,
    headers: { location: "http://169.254.169.254/latest" },
  });
  try {
    await assert.rejects(
      fetchLinkPreview("https://example.com/redirect"),
      /unsafe_redirect/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
