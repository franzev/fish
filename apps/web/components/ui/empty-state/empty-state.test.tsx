import { render, screen } from "@testing-library/react";
import { IconUsers } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("provides calm defaults without an action", () => {
    render(<EmptyState />);
    expect(screen.getByText("No messages yet")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("accepts contextual copy, icon, surface, and one action", () => {
    const { container } = render(
      <EmptyState
        icon={IconUsers}
        title="No clients yet"
        description="Assigned clients will appear here."
        appearance="surface"
        action={<button type="button">Invite a client</button>}
      />
    );
    expect(container.firstChild).toHaveClass("bg-surface", "rounded-card");
    expect(screen.getByRole("button", { name: "Invite a client" })).toBeVisible();
  });
});
