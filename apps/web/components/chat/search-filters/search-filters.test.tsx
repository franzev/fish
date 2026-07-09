import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FiltersDialog } from "./filters-dialog";
import { SearchFilterPopover } from "./search-filter-popover";

function openPopover() {
  fireEvent.click(screen.getByRole("button", { name: "Search messages" }));
}

describe("SearchFilterPopover", () => {
  it("opens a popover with a search input and the quick filters", () => {
    render(<SearchFilterPopover value="" onValueChange={vi.fn()} />);

    openPopover();

    expect(
      screen.getByPlaceholderText("Search messages")
    ).toBeInTheDocument();
    for (const title of [
      "From a specific user",
      "Sent in a specific channel",
      "Includes a specific type of data",
      "Mentions a specific user",
    ]) {
      expect(
        screen.getByRole("button", { name: new RegExp(title, "i") })
      ).toBeInTheDocument();
    }
  });

  it("shows the controlled value in the search input", () => {
    render(<SearchFilterPopover value="hola" onValueChange={vi.fn()} />);

    openPopover();

    expect(screen.getByPlaceholderText("Search messages")).toHaveValue(
      "hola"
    );
  });

  it("reports typing through onValueChange", () => {
    const onValueChange = vi.fn();
    render(<SearchFilterPopover value="" onValueChange={onValueChange} />);

    openPopover();
    fireEvent.change(screen.getByPlaceholderText("Search messages"), {
      target: { value: "hello" },
    });

    expect(onValueChange).toHaveBeenCalledWith("hello");
  });

  it("appends the quick-filter token without a leading space when empty", () => {
    const onValueChange = vi.fn();
    render(<SearchFilterPopover value="" onValueChange={onValueChange} />);

    openPopover();
    fireEvent.click(
      screen.getByRole("button", { name: /from a specific user/i })
    );

    expect(onValueChange).toHaveBeenCalledWith("from: ");
  });

  it("appends the quick-filter token after existing text", () => {
    const onValueChange = vi.fn();
    render(
      <SearchFilterPopover value="hello" onValueChange={onValueChange} />
    );

    openPopover();
    fireEvent.click(
      screen.getByRole("button", { name: /mentions a specific user/i })
    );

    expect(onValueChange).toHaveBeenCalledWith("hello mentions: ");
  });

  it("appends without doubling the space after a trailing-space value", () => {
    const onValueChange = vi.fn();
    render(
      <SearchFilterPopover value="hello " onValueChange={onValueChange} />
    );

    openPopover();
    fireEvent.click(
      screen.getByRole("button", { name: /from a specific user/i })
    );

    expect(onValueChange).toHaveBeenCalledWith("hello from: ");
  });

  it("returns focus to the search trigger after the dialog closes", async () => {
    render(<SearchFilterPopover value="" onValueChange={vi.fn()} />);

    openPopover();
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // The popover (the dialog's opener) unmounted when the dialog opened, so
    // without an explicit finalFocus target focus would fall to <body>.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Search messages" })
      ).toHaveFocus()
    );
  });

  it("opens the Filters dialog from More filters", () => {
    render(<SearchFilterPopover value="" onValueChange={vi.fn()} />);

    openPopover();
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));

    expect(
      screen.getByRole("dialog", { name: /filters/i })
    ).toBeInTheDocument();
  });
});

describe("FiltersDialog", () => {
  it("renders a dialog named Filters with every filter field", () => {
    render(<FiltersDialog open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    for (const label of ["From", "In", "Has", "Mentions", "Date"]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    // The date stub is an honest inert well, not a dead-end button.
    expect(within(dialog).getByText("+ Add date")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /add date/i })
    ).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Clear filters" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Apply" })
    ).toBeInTheDocument();
  });

  it.each(["Clear filters", "Cancel", "Apply"])(
    "closes the dialog via %s without filtering anything",
    (name) => {
      const onOpenChange = vi.fn();
      render(<FiltersDialog open onOpenChange={onOpenChange} />);

      fireEvent.click(screen.getByRole("button", { name }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    }
  );

  it("renders nothing while closed", () => {
    render(<FiltersDialog open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
