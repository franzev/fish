import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthSplitLayout } from "./auth-split-layout";

describe("AuthSplitLayout", () => {
  it("uses the quiet school of fish by default", () => {
    const { container } = render(
      <AuthSplitLayout headline="Welcome" message="A calm message.">
        <p>Form content</p>
      </AuthSplitLayout>
    );

    const authShell = container.querySelector("main");

    expect(authShell).toHaveClass("lg:h-dvh", "lg:overflow-hidden");
    expect(authShell?.firstElementChild).toHaveClass(
      "lg:h-full",
      "lg:min-h-0",
      "lg:overflow-y-auto"
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders route-specific artwork as decorative", () => {
    const { container } = render(
      <AuthSplitLayout
        headline="Welcome"
        message="A calm message."
        illustrationSrc="/illustrations/sign-in-fish-bowl.svg"
      >
        <p>Form content</p>
      </AuthSplitLayout>
    );

    const illustration = container.querySelector("img");

    expect(illustration).toHaveAttribute(
      "src",
      "/illustrations/sign-in-fish-bowl.svg"
    );
    expect(illustration).toHaveAttribute("alt", "");
    expect(illustration).toHaveClass(
      "absolute",
      "right-0",
      "bottom-0",
      "w-full",
      "opacity-20",
      "saturate-0"
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.querySelector("aside p")).toHaveClass("text-hero");
  });
});
