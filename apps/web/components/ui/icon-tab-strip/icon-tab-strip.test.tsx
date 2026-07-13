import { fireEvent, render, screen } from "@testing-library/react";
import { Tabs } from "@base-ui/react/tabs";
import { IconHeart, IconLayoutGrid } from "@tabler/icons-react";
import { describe, expect, it, vi } from "vitest";
import { IconTabStrip } from "./icon-tab-strip";

const items = [
  { value: "all", label: "All", Icon: IconLayoutGrid },
  { value: "cute", label: "Cute", Icon: IconHeart },
] as const;

describe("IconTabStrip", () => {
  it("provides the shared bottom-strip styling and tab selection", () => {
    const onValueChange = vi.fn();
    render(
      <Tabs.Root defaultValue="all" onValueChange={onValueChange}>
        <IconTabStrip items={items} ariaLabel="Sticker style" />
      </Tabs.Root>
    );

    expect(screen.getByRole("tablist", { name: "Sticker style" })).toHaveClass(
      "border-t",
      "border-divider"
    );

    fireEvent.click(screen.getByRole("tab", { name: "Cute" }));
    expect(onValueChange).toHaveBeenCalledWith("cute", expect.anything());
  });

  it("uses pressed buttons when the strip controls filters", () => {
    const onValueChange = vi.fn();
    render(
      <IconTabStrip
        items={items}
        ariaLabel="Sticker style"
        selectionMode="filter"
        value="all"
        onValueChange={onValueChange}
      />
    );

    expect(screen.getByRole("group", { name: "Sticker style" })).toHaveClass(
      "border-t",
      "border-divider"
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Cute" }));
    expect(onValueChange).toHaveBeenCalledWith("cute");
  });

  it("shows its Base UI tooltip on keyboard focus", async () => {
    render(
      <Tabs.Root defaultValue="all">
        <IconTabStrip items={items} ariaLabel="Sticker style" />
      </Tabs.Root>
    );

    fireEvent.focus(screen.getByRole("tab", { name: "Cute" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Cute");
  });
});
