import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("reports its accessible state and next value", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        aria-label="Use less data"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    );

    const control = screen.getByRole("switch", { name: "Use less data" });
    expect(control).toHaveAttribute("aria-checked", "false");
    fireEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("uses the shared touch target and forwards its button ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Switch
        ref={ref}
        aria-label="Use less data"
        checked
        onCheckedChange={() => undefined}
      />
    );

    expect(ref.current).toBe(screen.getByRole("switch"));
    expect(ref.current).toHaveClass("min-h-control", "min-w-control");
  });

  it("does not change when disabled", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        aria-label="Use less data"
        checked={false}
        disabled
        onCheckedChange={onCheckedChange}
      />
    );

    fireEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("participates in native form submission", () => {
    render(
      <form aria-label="Preferences">
        <Switch
          aria-label="Use less data"
          name="videoQuality"
          value="data-saver"
          checked
          onCheckedChange={() => undefined}
        />
      </form>
    );

    const form = screen.getByRole("form", { name: "Preferences" }) as HTMLFormElement;
    expect(new FormData(form).get("videoQuality")).toBe("data-saver");
  });
});
