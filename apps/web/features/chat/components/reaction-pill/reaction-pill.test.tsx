import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactionPill } from "./reaction-pill";

describe("ReactionPill", () => {
  it("keeps a 44px mobile target and the compact desktop pill", () => {
    render(<ReactionPill aria-label="Add a reaction">+</ReactionPill>);

    expect(screen.getByRole("button", { name: "Add a reaction" })).toHaveClass(
      "min-h-control",
      "min-w-control",
      "md:min-w-0",
      "md:min-h-reaction-pill"
    );
  });

  it("keeps mobile confirmation transforms off the interactive target", () => {
    render(
      <ReactionPill aria-label="One reaction">
        <span className="max-md:animate-reaction-pop">👍</span>
      </ReactionPill>
    );

    expect(screen.getByRole("button", { name: "One reaction" })).not.toHaveClass(
      "animate-reaction-pop"
    );
  });
});
