import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  CallCommandService,
  CallRealtimeService,
  ClientCall,
} from "@/lib/services";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CallProvider, useCall, type CallMedia } from "./call-provider";

const connectMock = vi.fn(async () => undefined);
const disconnectMock = vi.fn(async () => undefined);

function fakeMedia(): CallMedia {
  return {
    connect: connectMock,
    disconnect: disconnectMock,
    setMuted: vi.fn(async () => undefined),
    setCameraEnabled: vi.fn(async () => undefined),
    startAudio: vi.fn(async () => undefined),
    microphones: vi.fn(async () => []),
    switchMicrophone: vi.fn(async () => undefined),
    setVideoQualityPreference: vi.fn(),
  };
}

const ringingCall: ClientCall = {
  id: "call-1",
  lessonSlotId: null,
  coachId: "coach-1",
  clientId: "client-1",
  initiatedBy: "coach-1",
  kind: "audio",
  status: "ringing",
  expiresAt: "2030-01-01T00:00:00.000Z",
  acceptedAt: null,
  connectedAt: null,
  endedAt: null,
  endReason: null,
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z",
};

function Probe() {
  const { answer, state } = useCall();
  return (
    <>
      <output>
        {state.current.status}:{state.current.counterpartName}
      </output>
      <button type="button" onClick={() => void answer()}>Answer</button>
    </>
  );
}

function services(call: ClientCall | null) {
  const found = call ? { call, counterpartName: "Coach Mina" } : null;
  const commands = {
    accept: vi.fn(async () => ({
      ok: true as const,
      call: call ?? ringingCall,
      connection: {
        serverUrl: "wss://calls.example",
        participantToken: "accepted-token",
      },
    })),
    join: vi.fn(async () => ({
      ok: true as const,
      call: call ?? ringingCall,
      connection: {
        serverUrl: "wss://calls.example",
        participantToken: "token",
      },
    })),
  } as unknown as CallCommandService;
  const realtime = {
    subscribe: vi.fn(() => vi.fn()),
    findCurrentCall: vi.fn(async () => found),
    findCall: vi.fn(async () => found),
  } as unknown as CallRealtimeService;

  return { commands, realtime };
}

describe("CallProvider", () => {
  beforeEach(() => {
    connectMock.mockClear();
    disconnectMock.mockClear();
  });

  it("recovers an incoming call in place without route-owned presentation", async () => {
    const { commands, realtime } = services(ringingCall);

    render(
      <CallProvider userId="client-1" commands={commands} realtime={realtime} media={fakeMedia()} requestPermission={async () => "granted"}>
        <Probe />
      </CallProvider>
    );

    expect(await screen.findByText("ringing:Coach Mina")).toBeVisible();
    expect(realtime.findCurrentCall).toHaveBeenCalledWith("client-1");
    expect(realtime.findCall).toHaveBeenCalledWith("call-1", "client-1");
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("rejoins an active call during provider recovery", async () => {
    const activeCall: ClientCall = {
      ...ringingCall,
      status: "active",
      acceptedAt: "2030-01-01T00:00:01.000Z",
      connectedAt: "2030-01-01T00:00:02.000Z",
    };
    const { commands, realtime } = services(activeCall);

    render(
      <CallProvider userId="client-1" commands={commands} realtime={realtime} media={fakeMedia()} requestPermission={async () => "granted"}>
        <Probe />
      </CallProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("active:Coach Mina")).toBeVisible();
    });
    expect(commands.join).toHaveBeenCalledWith("call-1");
    expect(connectMock).toHaveBeenCalledWith(
      "call-1",
      expect.objectContaining({ participantToken: "token" }),
      { microphone: true, camera: false }
    );
  });

  it("coalesces the initial and subscribed recovery callbacks into one media join", async () => {
    const activeCall: ClientCall = {
      ...ringingCall,
      status: "active",
      acceptedAt: "2030-01-01T00:00:01.000Z",
      connectedAt: "2030-01-01T00:00:02.000Z",
    };
    const { commands, realtime } = services(activeCall);
    vi.mocked(realtime.subscribe).mockImplementation(
      (_userId, _onEvent, onRecovery) => {
        onRecovery?.();
        return vi.fn();
      }
    );

    render(
      <CallProvider userId="client-1" commands={commands} realtime={realtime} media={fakeMedia()} requestPermission={async () => "granted"}>
        <Probe />
      </CallProvider>
    );

    await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
    expect(commands.join).toHaveBeenCalledTimes(1);
  });

  it("coalesces an incoming answer with concurrent recovery", async () => {
    let onRecovery: (() => void) | undefined;
    let resolveAccept: ((result: Awaited<ReturnType<CallCommandService["accept"]>>) => void) | undefined;
    const acceptedCall: ClientCall = {
      ...ringingCall,
      status: "connecting",
      acceptedAt: "2030-01-01T00:00:01.000Z",
    };
    const { commands, realtime } = services(ringingCall);
    vi.mocked(commands.accept).mockImplementation(() => new Promise((resolve) => {
      resolveAccept = resolve;
    }));
    vi.mocked(realtime.subscribe).mockImplementation((_userId, _handler, recover) => {
      onRecovery = recover;
      return vi.fn();
    });

    render(
      <CallProvider userId="client-1" commands={commands} realtime={realtime} media={fakeMedia()} requestPermission={async () => "granted"}>
        <Probe />
      </CallProvider>
    );

    expect(await screen.findByText("ringing:Coach Mina")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    await waitFor(() => expect(commands.accept).toHaveBeenCalledWith("call-1"));

    vi.mocked(realtime.findCall).mockResolvedValue({
      call: acceptedCall,
      counterpartName: "Coach Mina",
    });
    onRecovery?.();
    resolveAccept?.({
      ok: true,
      call: acceptedCall,
      connection: {
        serverUrl: "wss://calls.example",
        participantToken: "accepted-token",
      },
    });

    await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
    expect(commands.accept).toHaveBeenCalledTimes(1);
    expect(commands.join).not.toHaveBeenCalled();
  });
});
