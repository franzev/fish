import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageImages } from "./message-images";

const mocks = vi.hoisted(() => ({ refreshUrls: vi.fn() }));
vi.mock("@/lib/services/runtime/browser", () => ({
  getChatImageService: () => ({ refreshUrls: mocks.refreshUrls }),
}));

const image = {
  id: "image-1",
  status: "ready" as const,
  originalName: "photo.png",
  width: 1200,
  height: 800,
  thumbnailPath: "chat/image/thumbnail.webp",
  displayPath: "chat/image/display.webp",
};

describe("MessageImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and refreshes signed URLs without flashing an unavailable state", async () => {
    mocks.refreshUrls.mockResolvedValueOnce([
      { path: image.thumbnailPath, signedUrl: "https://storage.test/thumbnail" },
      { path: image.displayPath, signedUrl: "https://storage.test/display" },
    ]);
    render(<MessageImages images={[image]} authorName="Alex" mine={false} />);

    expect(screen.getByLabelText("Loading image")).toBeInTheDocument();
    expect(screen.queryByText("Image unavailable")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.refreshUrls).toHaveBeenCalledWith([image.id]));
  });

  it("renders a non-image attachment as a file card", () => {
    render(<MessageImages images={[{
      id: "file-1",
      status: "ready",
      kind: "file",
      originalName: "notes.pdf",
      mimeType: "application/pdf",
      byteSize: 2048,
      displayPath: "chat/file/file.pdf",
      displayUrl: "https://storage.test/file",
    }]} authorName="Alex" mine={false} />);

    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
    expect(screen.getByText("PDF · 2 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open notes.pdf" })).toBeInTheDocument();
  });

  it("refreshes a private file URL immediately before opening it", async () => {
    const replace = vi.fn();
    const popup = { opener: window, location: { replace }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    mocks.refreshUrls.mockResolvedValueOnce([
      { path: "chat/file/file.pdf", signedUrl: "https://storage.test/fresh-file" },
    ]);
    render(<MessageImages images={[{
      id: "file-1",
      status: "ready",
      kind: "file",
      originalName: "notes.pdf",
      displayPath: "chat/file/file.pdf",
      displayUrl: "https://storage.test/expired-file",
    }]} authorName="Alex" mine={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Open notes.pdf" }));

    await waitFor(() => expect(mocks.refreshUrls).toHaveBeenCalledWith(["file-1"]));
    expect(popup.opener).toBeNull();
    expect(replace).toHaveBeenCalledWith("https://storage.test/fresh-file");
  });

  it("offers a calm retry when a file URL cannot be refreshed", async () => {
    const close = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({
      opener: window,
      location: { replace: vi.fn() },
      close,
    } as unknown as Window);
    mocks.refreshUrls.mockResolvedValueOnce([]);
    render(<MessageImages images={[{
      id: "file-1",
      status: "ready",
      kind: "file",
      originalName: "notes.pdf",
      displayPath: "chat/file/file.pdf",
    }]} authorName="Alex" mine={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Open notes.pdf" }));

    expect(await screen.findByRole("button", { name: "Retry notes.pdf" })).toBeInTheDocument();
    expect(close).toHaveBeenCalled();
  });

  it("preserves mixed attachment order around grouped image runs", () => {
    const { container } = render(<MessageImages images={[
      { ...image, id: "first", thumbnailUrl: "blob:first", displayUrl: "blob:first" },
      {
        id: "file-1",
        status: "ready",
        kind: "file",
        originalName: "between.pdf",
        displayPath: "chat/file/file.pdf",
      },
      { ...image, id: "last", thumbnailUrl: "blob:last", displayUrl: "blob:last" },
    ]} authorName="Alex" mine={false} />);

    const group = container.querySelector('[aria-label="3 shared attachments"]');
    expect(group?.children).toHaveLength(3);
    expect(group?.children[0]).toHaveAttribute("data-image-layout", "single");
    expect(group?.children[1]).toHaveTextContent("between.pdf");
    expect(group?.children[2]).toHaveAttribute("data-image-layout", "single");
  });

  it("does not classify an uploaded image as a sticker from its filename", () => {
    const { container } = render(<MessageImages
      images={[{
        ...image,
        originalName: "aquatic-awesome-dolphin.webp",
        thumbnailUrl: "blob:sticker",
        displayUrl: "blob:sticker",
      }]}
      authorName="Alex"
      mine={false}
    />);

    const frame = container.querySelector('[data-image-layout="single"]')?.firstElementChild;
    expect(frame).toHaveClass("max-h-chat-image-max-height", "bg-surface-2");
    expect(frame).not.toHaveClass("max-w-sticker-tile");
    expect(screen.getByAltText("Image shared by Alex")).toHaveClass("object-cover");
    expect(screen.getByRole("button", { name: "Open image shared by Alex" })).toBeInTheDocument();
  });

  it("crossfades from a blurred thumbnail to the sharp display image", () => {
    const { container } = render(<MessageImages
      images={[{
        ...image,
        thumbnailUrl: "https://storage.test/thumbnail",
        displayUrl: "https://storage.test/display",
      }]}
      authorName="Alex"
      mine={false}
    />);

    const preview = container.querySelector<HTMLImageElement>('[data-image-quality="preview"]');
    const full = container.querySelector<HTMLImageElement>('[data-image-quality="full"]');
    expect(preview).toHaveClass("scale-110", "blur-md");
    expect(full).toHaveClass("opacity-0");

    fireEvent.load(preview!);
    fireEvent.load(full!);

    expect(preview).toHaveClass("opacity-0");
    expect(full).toHaveClass("opacity-100");
  });

  it.each([
    { count: 1, layout: "single" },
    { count: 2, layout: "wrap" },
    { count: 3, layout: "wrap" },
    { count: 4, layout: "wrap" },
    { count: 5, layout: "wrap" },
  ])("lays out $count image(s) from left to right", ({ count, layout }) => {
    const { container } = render(<MessageImages
      images={Array.from({ length: count }, (_, index) => ({
        ...image,
        id: `image-${index}`,
        thumbnailUrl: `blob:image-${index}`,
        displayUrl: `blob:image-${index}`,
      }))}
      authorName="Alex"
      mine={false}
    />);

    const gallery = container.querySelector(`[data-image-layout="${layout}"]`);
    expect(gallery?.children).toHaveLength(count);
    expect(gallery).toHaveClass("flex", "flex-wrap", "gap-nudge");
    Array.from(gallery?.children ?? []).forEach((tile) => {
      if (count > 1) {
        expect(tile).toHaveClass("max-h-chat-image-preview", "w-auto", "max-w-full", "shrink-0");
        expect(tile).not.toHaveClass("grow", "flex-1");
        expect(tile).toHaveStyle({ aspectRatio: "1.5" });
      } else {
        expect(tile).toHaveClass("max-h-chat-image-max-height");
      }
    });
  });

  it("bounds extreme preview frames without changing source order", () => {
    const { container } = render(<MessageImages
      images={[
        { ...image, id: "tall", width: 200, height: 1200, thumbnailUrl: "blob:tall", displayUrl: "blob:tall" },
        { ...image, id: "wide", width: 1600, height: 200, thumbnailUrl: "blob:wide", displayUrl: "blob:wide" },
      ]}
      authorName="Alex"
      mine={false}
    />);

    const items = container.querySelector('[data-image-layout="wrap"]')?.children;
    expect(items?.[0]).toHaveStyle({ aspectRatio: String(2 / 3) });
    expect(items?.[1]).toHaveStyle({ aspectRatio: "2" });
  });

  it.each([
    { mine: false, alignment: "justify-start", opposite: "justify-end" },
    { mine: true, alignment: "justify-end", opposite: "justify-start" },
  ])("aligns image previews with the message bubble when mine is $mine", ({ mine, alignment, opposite }) => {
    const { container } = render(<MessageImages
      images={[{
        ...image,
        thumbnailUrl: "blob:aligned-image",
        displayUrl: "blob:aligned-image",
      }]}
      authorName={mine ? "You" : "Alex"}
      mine={mine}
    />);

    const gallery = container.querySelector('[data-image-layout="single"]');
    expect(gallery).toHaveClass(alignment);
    expect(gallery).not.toHaveClass(opposite);
  });
});
