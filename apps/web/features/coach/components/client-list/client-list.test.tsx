import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { ClientList } from "./client-list";

describe("ClientList", () => {
  it("renders rows in alphabetical order regardless of input order (D-15)", () => {
    render(
      <ClientList
        clients={[
          { id: "3", displayName: "Sam Okafor", email: "sam@fish.dev" },
          { id: "1", displayName: "Alex Rivera", email: "alex@fish.dev" },
          { id: "2", displayName: "Priya Nair", email: "priya@fish.dev" },
        ]}
      />
    );

    const names = screen
      .getAllByText(/Rivera|Nair|Okafor/)
      .map((el) => el.textContent);
    expect(names).toEqual(["Alex Rivera", "Priya Nair", "Sam Okafor"]);
  });

  it("renders each client's name and muted email (D-13)", () => {
    render(
      <ClientList
        clients={[
          { id: "1", displayName: "Alex Rivera", email: "alex@fish.dev" },
        ]}
      />
    );

    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("alex@fish.dev")).toBeInTheDocument();
  });

  it("does not mutate the incoming clients prop", () => {
    const clients = [
      { id: "2", displayName: "Sam Okafor", email: "sam@fish.dev" },
      { id: "1", displayName: "Alex Rivera", email: "alex@fish.dev" },
    ];
    const original = [...clients];

    render(<ClientList clients={clients} />);

    expect(clients).toEqual(original);
  });

  it("renders rows as links to each coach client detail route (PROF-06)", () => {
    render(
      <ClientList
        clients={[
          { id: "3", displayName: "Sam Okafor", email: "sam@fish.dev" },
          { id: "1", displayName: "Alex Rivera", email: "alex@fish.dev" },
          { id: "2", displayName: "Priya Nair", email: "priya@fish.dev" },
        ]}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/coach/clients/1",
      "/coach/clients/2",
      "/coach/clients/3",
    ]);
  });

  it("contains no cursor-pointer or hover: classes anywhere in its source (calm linked rows)", () => {
    const source = readFileSync(resolve(__dirname, "./client-list.tsx"), "utf-8");
    expect(source).not.toMatch(/cursor-pointer|hover:/);
    expect(source).not.toMatch(/not tappable yet/i);
  });

  it("renders a single Card with divide-y dividers, not one Card per row (D-12)", () => {
    const { container } = render(
      <ClientList
        clients={[
          { id: "1", displayName: "Alex Rivera", email: "alex@fish.dev" },
          { id: "2", displayName: "Priya Nair", email: "priya@fish.dev" },
        ]}
      />
    );

    const cards = container.querySelectorAll(".divide-y");
    expect(cards.length).toBe(1);
  });
});
