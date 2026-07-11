import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ChatFilterCriterion } from "@/features/chat/model/search";
import { FiltersDialog } from "./filters-dialog";
import { SearchFilterPopover } from "./search-filter-popover";

const members = [
  { id: "11111111-1111-4111-8111-111111111111", displayName: "Yoshibro", username: "yoshibro5019" },
  { id: "22222222-2222-4222-8222-222222222222", displayName: "Sir Regan", username: "reganspor" },
  { id: "33333333-3333-4333-8333-333333333333", displayName: "stellostuds", username: "juststello" },
];

const channels = [
  { id: "44444444-4444-4444-8444-444444444444", name: "general", slug: "general", conversationId: "55555555-5555-4555-8555-555555555555" },
  { id: "66666666-6666-4666-8666-666666666666", name: "coaching", slug: "coaching", conversationId: "77777777-7777-4777-8777-777777777777" },
];

function Harness({ initialValue = "", onOpenFilters = vi.fn(), onSubmit = vi.fn() }: { initialValue?: string; onOpenFilters?: () => void; onSubmit?: (query: string, criteria: ChatFilterCriterion[]) => void }) {
  const [value, setValue] = useState(initialValue);
  const [criteria, setCriteria] = useState<ChatFilterCriterion[]>([]);
  return (
    <SearchFilterPopover
      value={value}
      onValueChange={setValue}
      criteria={criteria}
      onCriteriaChange={setCriteria}
      members={members}
      channels={channels}
      onOpenFilters={onOpenFilters}
      onSubmit={onSubmit}
    />
  );
}

function openCommandMenu() {
  fireEvent.focus(screen.getByRole("combobox", { name: "Search messages" }));
}

describe("SearchFilterPopover", () => {
  it("shows the controlled always-visible search input", () => {
    render(<SearchFilterPopover value="hola" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Search messages" })).toHaveValue("hola");
  });

  it("renders the exact five-row command menu", () => {
    render(<Harness />);
    openCommandMenu();

    expect(screen.getByRole("menu", { name: "Search filters" })).toBeInTheDocument();
    expect(document.getElementById("chat-search-panel")).toHaveClass("top-full");
    for (const title of [
      "From a specific user",
      "Sent in a specific channel",
      "Includes a specific type of data",
      "Mentions a specific user",
      "More filters",
    ]) {
      expect(screen.getByRole("menuitem", { name: new RegExp(title, "i") })).toBeInTheDocument();
    }
  });

  it("closes the popover when focus leaves the search control", () => {
    render(
      <div>
        <Harness />
        <button type="button">Outside</button>
      </div>
    );
    const input = screen.getByRole("combobox", { name: "Search messages" });
    fireEvent.focus(input);
    expect(screen.getByRole("menu", { name: "Search filters" })).toBeInTheDocument();

    const outside = screen.getByRole("button", { name: "Outside" });
    fireEvent.blur(input, { relatedTarget: outside });

    expect(screen.queryByRole("menu", { name: "Search filters" })).toBeNull();
  });

  it("inserts from: from the command menu and immediately shows channel members", () => {
    render(<Harness />);
    openCommandMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /from a specific user/i }));

    expect(screen.getByText("from:")).toBeInTheDocument();
    const list = screen.getByRole("listbox", { name: "From User" });
    expect(within(list).getByRole("option", { name: /Yoshibro yoshibro5019/i })).toBeInTheDocument();
    expect(within(list).getAllByRole("option")).toHaveLength(3);
  });

  it("shows user suggestions when from: is typed directly", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search messages" });
    fireEvent.change(input, { target: { value: "from:" } });

    expect(screen.getByRole("listbox", { name: "From User" })).toBeInTheDocument();
  });

  it("suggests the current channel members when mentions: is typed directly", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search messages" });
    fireEvent.change(input, { target: { value: "mentions:" } });

    const list = screen.getByRole("listbox", { name: "Mentions User" });
    expect(within(list).getAllByRole("option")).toHaveLength(members.length);
  });

  it("searches every available channel from the in: autocomplete", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search messages" });
    fireEvent.change(input, { target: { value: "in:" } });
    fireEvent.change(input, { target: { value: "coach" } });

    const list = screen.getByRole("listbox", { name: "In Channel" });
    expect(within(list).getByRole("option", { name: "coaching" })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: "general" })).toBeNull();
  });

  it("filters from: suggestions by display name or username", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search messages" });
    fireEvent.change(input, { target: { value: "from:" } });
    fireEvent.change(input, { target: { value: "reg" } });

    const list = screen.getByRole("listbox", { name: "From User" });
    expect(within(list).getByRole("option", { name: /Sir Regan reganspor/i })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: /Yoshibro/i })).toBeNull();
  });

  it("renders selected criteria as filled tokens inside the search field", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search messages" });
    fireEvent.change(input, { target: { value: "from:" } });
    fireEvent.change(input, { target: { value: "reg" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("combobox", { name: "Search messages" })).toHaveValue("from: reganspor ");
    expect(screen.getByTestId("search-filter-token")).toHaveTextContent("from: reganspor");
    expect(screen.queryByLabelText("Applied filters")).toBeNull();
  });

  it("supports arrow-key navigation and Escape dismissal", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search messages" });
    fireEvent.change(input, { target: { value: "from:" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /Sir Regan/i })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "From User" })).toBeNull();
  });

  it("opens More filters from the focused search menu", () => {
    const onOpenFilters = vi.fn();
    render(<Harness onOpenFilters={onOpenFilters} />);
    openCommandMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /more filters/i }));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it("does not submit while typing and submits from the explicit suggestion", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByRole("combobox", { name: "Search messages" });
    fireEvent.change(input, { target: { value: "practice" } });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("option", { name: "Search for practice" }));
    expect(onSubmit).toHaveBeenCalledWith("practice", []);
  });
});

describe("FiltersDialog", () => {
  it("renders every screenshot filter and one primary apply action", () => {
    render(<FiltersDialog open onOpenChange={vi.fn()} members={members} channels={channels} />);
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    for (const label of ["From", "Mentions", "In", "Has", "Date", "Author type"]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByRole("group", { name: "Pinned" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add date" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Clear filters (0)" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Apply filters" })).toBeInTheDocument();
  });

  it("adds and individually removes multiple date criteria", () => {
    render(<FiltersDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add date" }));
    fireEvent.click(screen.getByRole("button", { name: "Add date" }));
    expect(screen.getAllByRole("button", { name: /Remove date/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove date 1" }));
    expect(screen.getAllByRole("button", { name: /Remove date/ })).toHaveLength(1);
  });

  it("opens the calendar and exposes month navigation and a grid", () => {
    render(<FiltersDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add date" }));
    fireEvent.click(screen.getByRole("button", { name: "Date 1" }));
    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("selects a From member and applies the canonical query", () => {
    const onApply = vi.fn();
    render(<FiltersDialog open onOpenChange={vi.fn()} members={members} channels={channels} query="hello" onApply={onApply} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "From user" }));
    fireEvent.click(screen.getByRole("option", { name: /Yoshibro.*yoshibro5019/i }));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(onApply).toHaveBeenCalledWith(
      "hello from: yoshibro5019",
      [expect.objectContaining({ kind: "from", member: members[0] })]
    );
  });

  it("clears the draft without closing and Cancel closes without applying", () => {
    const onOpenChange = vi.fn();
    const criterion: ChatFilterCriterion = { id: "has:file", kind: "has", contentKind: "file" };
    render(<FiltersDialog open onOpenChange={onOpenChange} criteria={[criterion]} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters (1)" }));
    expect(screen.getByRole("button", { name: "Clear filters (0)" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
