import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

describe("Card", () => {
  it("renders the elevated surface tokens including the shadow-card elevation", () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-card");
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("shadow-[var(--shadow-card)]");
  });
});
