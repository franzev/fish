import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageBody } from "./message-body";

describe("MessageBody", () => {
  it("renders nothing for an empty or whitespace-only body, and never throws", () => {
    const { container: emptyContainer } = render(<MessageBody body="" />);
    expect(emptyContainer).toBeEmptyDOMElement();

    expect(() => render(<MessageBody body={"   \n  "} />)).not.toThrow();
    const { container: whitespaceContainer } = render(<MessageBody body={"   \n  "} />);
    expect(whitespaceContainer).toBeEmptyDOMElement();
  });

  it("renders bold text as <strong>", () => {
    render(<MessageBody body="This is **bold** text." />);
    const strong = screen.getByText("bold");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders star-italic and underscore-italic as <em>", () => {
    render(<MessageBody body="A *star* and an _underscore_ italic." />);
    expect(screen.getByText("star").tagName).toBe("EM");
    expect(screen.getByText("underscore").tagName).toBe("EM");
  });

  it("renders inline code with font-mono styling", () => {
    render(<MessageBody body="Run `pnpm test` first." />);
    const code = screen.getByText("pnpm test");
    expect(code.tagName).toBe("CODE");
    expect(code.className).toContain("font-mono");
  });

  it("renders a fenced code block as <pre><code> without inline-parsing its contents", () => {
    const { container } = render(
      <MessageBody body={"```ts\nconst x = **not bold**;\n```"} />
    );
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    const code = pre?.querySelector("code");
    expect(code?.textContent).toBe("const x = **not bold**;");
    // The language label is shown, and the raw asterisks were never turned
    // into a <strong> inside the code block.
    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(pre?.querySelector("strong")).toBeNull();
  });

  it("renders a fenced code block with no language label when none is given", () => {
    const { container } = render(<MessageBody body={"```\nplain code\n```"} />);
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toBe("plain code");
  });

  it("renders #, ##, ### as heading elements sized via text tokens", () => {
    render(<MessageBody body={"# One\n## Two\n### Three"} />);
    const h1 = screen.getByText("One");
    const h2 = screen.getByText("Two");
    const h3 = screen.getByText("Three");
    expect(h1.tagName).toBe("H1");
    expect(h2.tagName).toBe("H2");
    expect(h3.tagName).toBe("H3");
    expect(h1.className).toContain("text-heading-sm");
    expect(h2.className).toContain("text-ui-md");
    expect(h3.className).toContain("text-ui-sm");
  });

  it("renders a blockquote for '> ' lines", () => {
    const { container } = render(<MessageBody body="> Keep the pace slow." />);
    const quote = container.querySelector("blockquote");
    expect(quote).not.toBeNull();
    expect(quote?.textContent).toBe("Keep the pace slow.");
  });

  it("renders a bullet list and a numbered list", () => {
    const { container: bulletContainer } = render(
      <MessageBody body={"- First\n- Second"} />
    );
    expect(bulletContainer.querySelector("ul")).not.toBeNull();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();

    const { container: numberedContainer } = render(
      <MessageBody body={"1. Warm up\n2. Practice"} />
    );
    expect(numberedContainer.querySelector("ol")).not.toBeNull();
  });

  it("nests a bullet sub-list under its parent bullet item via indentation", () => {
    const { container } = render(
      <MessageBody body={"- Step one\n  - Detail A\n  - Detail B"} />
    );
    const topList = container.querySelector("ul");
    const nestedList = topList?.querySelector("li ul");
    expect(nestedList).not.toBeNull();
    expect(screen.getByText("Detail A")).toBeInTheDocument();
    expect(screen.getByText("Detail B")).toBeInTheDocument();
  });

  it("nests a numbered sub-list under its parent numbered item via indentation", () => {
    const { container } = render(
      <MessageBody body={"1. Warm up\n   1. Slow pass\n   2. Full speed"} />
    );
    const topList = container.querySelector("ol");
    const nestedList = topList?.querySelector("li ol");
    expect(nestedList).not.toBeNull();
    expect(screen.getByText("Slow pass")).toBeInTheDocument();
  });

  it("renders a link with target=_blank and rel=noopener noreferrer", () => {
    render(<MessageBody body="See the [guide](https://example.com/guide) here." />);
    const link = screen.getByRole("link", { name: "guide" });
    expect(link).toHaveAttribute("href", "https://example.com/guide");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("allows mailto: links", () => {
    render(<MessageBody body="Email [support](mailto:help@example.com)." />);
    const link = screen.getByRole("link", { name: "support" });
    expect(link).toHaveAttribute("href", "mailto:help@example.com");
  });

  it("SECURITY: neutralizes a javascript: link — renders as plain text, never a clickable href", () => {
    const { container } = render(
      <MessageBody body="Click [here](javascript:alert(1)) now." />
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("here");
    expect(container.textContent).not.toContain("javascript:");
  });

  it("SECURITY: neutralizes a data: link", () => {
    const { container } = render(
      <MessageBody body="Open [this](data:text/html,<script>alert(1)</script>)." />
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("this");
  });

  it("preserves line breaks: single \\n becomes a line break, blank line starts a new paragraph", () => {
    const { container } = render(
      <MessageBody body={"First line\nSecond line\n\nNew paragraph"} />
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelectorAll("br")).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe("First lineSecond line");
    expect(paragraphs[1].textContent).toBe("New paragraph");
  });

  it("applies the code-well contrast treatment based on `mine`", () => {
    const { container: receivedContainer } = render(
      <MessageBody body="Use `notes.md` here." mine={false} />
    );
    expect(receivedContainer.querySelector("code")?.className).toContain("bg-surface-2");

    const { container: mineContainer } = render(
      <MessageBody body="Use `notes.md` here." mine />
    );
    expect(mineContainer.querySelector("code")?.className).toContain("bg-on-primary/10");
  });
});
