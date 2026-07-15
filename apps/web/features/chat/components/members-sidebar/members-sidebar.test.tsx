import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MembersSidebar } from "./members-sidebar";

const members = [
  {
    id: "client-1",
    displayName: "Franz Santos",
    username: "franz",
    role: "client" as const,
    avatarUrl: "https://example.test/franz.png",
  },
  {
    id: "client-2",
    displayName: "Sam Okafor",
    username: "sam_okafor",
    role: "client" as const,
  },
];

describe("MembersSidebar", () => {
  it("renders the member directory in the responsive right-sidebar frame", () => {
    const onClose = vi.fn();
    render(
      <MembersSidebar
        members={members}
        currentUserId="client-1"
        currentUserRole="client"
        onClose={onClose}
      />
    );

    const sidebar = screen.getByRole("complementary", { name: "Members" });
    expect(sidebar).toHaveClass(
      "fixed",
      "inset-0",
      "md:relative",
      "md:w-members-panel"
    );
    expect(sidebar).toHaveClass("border-l", "border-divider");
    expect(sidebar.querySelector("header")).not.toHaveClass("border-b");
    expect(sidebar.querySelector("li")).not.toHaveClass("border-b");
    expect(screen.getByRole("heading", { name: "2 Members" })).toBeInTheDocument();
    expect(within(sidebar).getByText("Franz Santos")).toBeInTheDocument();
    expect(within(sidebar).getByText("@franz")).toHaveClass("text-ui-xs");
    expect(within(sidebar).getByText("Sam Okafor")).toBeInTheDocument();
    expect(within(sidebar).getByText("@sam_okafor")).toBeInTheDocument();

    fireEvent.click(
      within(sidebar).getByRole("button", { name: "View Sam Okafor profile" })
    );
    const quickView = screen.getByRole("dialog", { name: "Sam Okafor" });
    expect(within(quickView).getByText("@sam_okafor")).toBeInTheDocument();
    expect(within(quickView).getByText("Community member")).toBeInTheDocument();
    fireEvent.click(
      within(quickView).getByRole("button", { name: "Close Sam Okafor profile" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Close members" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a calm empty state", () => {
    render(
      <MembersSidebar
        members={[]}
        currentUserId="client-1"
        currentUserRole="client"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "0 Members" })).toBeInTheDocument();
    expect(screen.getByText("No members are available yet.")).toBeInTheDocument();
  });
});
