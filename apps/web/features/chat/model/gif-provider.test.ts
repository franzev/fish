import { describe, expect, it, vi } from "vitest";
import { KlipyGifProvider, mapKlipyResult } from "./gif-provider";

const result = {
  id: "cat-1",
  title: "Happy cat",
  content_description: "A happy cat nodding",
  itemurl: "https://klipy.com/gifs/cat-1",
  media_formats: {
    preview: { url: "https://static.klipy.com/cat.jpg", dims: [480, 270] },
    tinymp4: { url: "https://static1.klipy.com/cat-tiny.mp4", dims: [320, 180] },
    mp4: { url: "https://static2.klipy.com/cat.mp4", dims: [480, 270] },
  },
};

describe("KlipyGifProvider", () => {
  it("normalizes safe KLIPY results", () => {
    expect(mapKlipyResult(result)).toEqual({
      provider: "klipy",
      providerId: "cat-1",
      title: "Happy cat",
      description: "A happy cat nodding",
      sourceUrl: "https://klipy.com/gifs/cat-1",
      posterUrl: "https://static.klipy.com/cat.jpg",
      previewUrl: "https://static1.klipy.com/cat-tiny.mp4",
      mediaUrl: "https://static2.klipy.com/cat.mp4",
      width: 480,
      height: 270,
    });
  });

  it("drops results with untrusted media hosts or missing renditions", () => {
    expect(mapKlipyResult({ ...result, media_formats: {
      ...result.media_formats,
      mp4: { url: "https://example.com/cat.mp4", dims: [480, 270] },
    } })).toBeNull();
    expect(mapKlipyResult({ ...result, media_formats: {} })).toBeNull();
  });

  it("sends the exact phrase and required safety and rendition controls", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      results: [result],
      next: "page-2",
    }), { status: 200 }));
    const provider = new KlipyGifProvider("test-key");

    const page = await provider.search({ query: "  bruh?!  " });

    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe("/v2/search");
    expect(requested.searchParams.get("q")).toBe("bruh?!");
    expect(requested.searchParams.get("contentfilter")).toBe("high");
    expect(requested.searchParams.get("media_filter")).toBe("preview,tinymp4,mp4");
    expect(page.gifs).toHaveLength(1);
    expect(page.next).toBe("page-2");
    fetchMock.mockRestore();
  });

  it("fails calmly before a network request when no key is configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const provider = new KlipyGifProvider("");
    expect(provider.available).toBe(false);
    await expect(provider.trending()).rejects.toThrow("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
