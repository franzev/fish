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
    expect(
      container.querySelector('button[aria-label="Switch to dark mode"]')
    ).toBeInTheDocument();
    expect(container.querySelector("aside svg")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("aside p")?.parentElement).not.toHaveClass(
      "-translate-y-auth-copy-lift"
    );
  });

  it("renders route-specific artwork as decorative", () => {
    const { container } = render(
      <AuthSplitLayout
        headline="Welcome"
        message="A calm message."
        illustrationSrc="/illustrations/sign-in-onboarding-blue.svg"
      >
        <p>Form content</p>
      </AuthSplitLayout>
    );

    const illustration = container.querySelector("img");

    expect(illustration).toHaveAttribute(
      "src",
      "/illustrations/sign-in-onboarding-blue.svg"
    );
    expect(illustration).toHaveAttribute("alt", "");
    expect(illustration).toHaveClass(
      "absolute",
      "right-0",
      "bottom-0",
      "w-full",
      "translate-y-sm",
    );
    expect(illustration).not.toHaveClass("opacity-20", "saturate-0");
    expect(container.querySelector("aside svg")).not.toBeInTheDocument();
    expect(container.querySelector("aside p")).toHaveClass("text-hero");
    expect(container.querySelector("aside p")?.parentElement).toHaveClass(
      "-translate-y-auth-copy-lift"
    );
  });

  it("renders a theme-controlled artwork backdrop when provided", () => {
    const { container } = render(
      <AuthSplitLayout
        headline="Welcome"
        message="A calm message."
        illustrationSrc="/illustrations/sign-up-teamwork.svg"
        illustrationBackdropMaskSrc="/illustrations/sign-up-teamwork-backdrop.svg"
      >
        <p>Form content</p>
      </AuthSplitLayout>
    );

    const backdrop = container.querySelector('[aria-hidden="true"][style]');

    expect(backdrop).toHaveClass("bg-auth-illustration-shadow");
    expect(backdrop).toHaveStyle({
      maskImage: "url(/illustrations/sign-up-teamwork-backdrop.svg)",
    });
  });
});
