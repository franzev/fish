import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PresenceCommandService,
  PresenceCommandResult,
  PresenceRealtimeService,
  PresenceRepository,
  PresenceSnapshot,
} from "@/lib/services";
import { PresenceProvider, useOwnPresence, usePresence } from "./presence-provider";

const friendId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";

function snapshot(
  revision: number,
  status: PresenceSnapshot["status"]
): PresenceSnapshot {
  const timestamp = new Date().toISOString();
  return {
    userId: friendId,
    status,
    lastHeartbeatAt: timestamp,
    lastSeenAt: timestamp,
    revision,
    updatedAt: timestamp,
  };
}

function Probe() {
  const friend = usePresence(friendId);
  const own = useOwnPresence();
  return (
    <div>
      <span>Friend: {friend.label}</span>
      <span>Preference: {own.preference}</span>
      {own.notice && <span>{own.notice}</span>}
      <button type="button" onClick={() => void own.setPreference("invisible")}>
        Go invisible
      </button>
    </div>
  );
}

function createHarness(command: PresenceCommandService) {
  let onSnapshot: (value: PresenceSnapshot) => void = () => {};
  const repository: PresenceRepository = {
    listVisible: async () => ({ ok: true, data: [snapshot(2, "online")] }),
    getOwnPreference: async () => ({ ok: true, data: "away" }),
  };
  const realtime: PresenceRealtimeService = {
    subscribe: vi.fn((_id, nextSnapshot) => {
      onSnapshot = nextSnapshot;
      return () => {};
    }),
    startSession: vi.fn(() => ({ markActive: vi.fn(), stop: vi.fn() })),
  };
  render(
    <PresenceProvider
      userId={userId}
      repository={repository}
      commands={command}
      realtime={realtime}
    >
      <Probe />
    </PresenceProvider>
  );
  return { pushSnapshot: (value: PresenceSnapshot) => act(() => onSnapshot(value)) };
}

describe("PresenceProvider", () => {
  it("hydrates trusted snapshots and rejects out-of-order revisions", async () => {
    const command: PresenceCommandService = {
      setMode: async () => ({ ok: false, code: "unused", notice: "Unused" }),
    };
    const harness = createHarness(command);
    await waitFor(() => expect(screen.getByText("Friend: Online")).toBeInTheDocument());
    expect(screen.getByText("Preference: away")).toBeInTheDocument();

    harness.pushSnapshot(snapshot(1, "offline"));
    expect(screen.getByText("Friend: Online")).toBeInTheDocument();
    harness.pushSnapshot(snapshot(3, "busy"));
    expect(screen.getByText("Friend: Busy")).toBeInTheDocument();
  });

  it("waits for server confirmation and retains the prior mode on failure", async () => {
    let resolveCommand: (value: Awaited<ReturnType<PresenceCommandService["setMode"]>>) => void = () => {};
    const command: PresenceCommandService = {
      setMode: vi.fn(() => new Promise<PresenceCommandResult>((resolve) => {
        resolveCommand = resolve;
      })),
    };
    createHarness(command);
    await waitFor(() => expect(screen.getByText("Preference: away")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Go invisible" }));
    expect(screen.getByText("Preference: away")).toBeInTheDocument();
    await act(async () => resolveCommand({
      ok: false,
      code: "presence_unavailable",
      notice: "Your status could not change. Try again.",
    }));
    expect(screen.getByText("Preference: away")).toBeInTheDocument();
    expect(screen.getByText("Your status could not change. Try again."))
      .toBeInTheDocument();
  });
});
