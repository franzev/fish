import { describe, expect, it, vi } from "vitest";
import type { ClientCall } from "../contracts";
import type { AppSupabaseClient } from "./types";
import { SupabaseCallCommandService } from "./call-command-service";

const call: ClientCall = {
  id: "call-1",
  lessonSlotId: "lesson-1",
  coachId: "coach-1",
  clientId: "client-1",
  initiatedBy: "client-1",
  kind: "video",
  status: "ringing",
  expiresAt: "2026-07-21T10:20:45.000Z",
  acceptedAt: null,
  connectedAt: null,
  endedAt: null,
  endReason: null,
  createdAt: "2026-07-21T10:20:00.000Z",
  updatedAt: "2026-07-21T10:20:00.000Z",
};

function service(response: unknown) {
  const invoke = vi.fn(async () => response);
  const client = { functions: { invoke } } as unknown as AppSupabaseClient;
  return { command: new SupabaseCallCommandService(client), invoke };
}

describe("SupabaseCallCommandService", () => {
  it("starts a video call through the booked lesson command", async () => {
    const { command, invoke } = service({ data: { call }, error: null });
    await expect(command.initiateLesson({
      lessonId: "lesson-1",
      clientRequestId: "request-1",
    })).resolves.toEqual({ ok: true, call });
    expect(invoke).toHaveBeenCalledWith("call-command", {
      body: {
        action: "initiateLesson",
        lessonId: "lesson-1",
        clientRequestId: "request-1",
      },
      timeout: 15_000,
    });
  });

  it("returns a short-lived diagnostic connection without requiring a call", async () => {
    const connection = {
      serverUrl: "wss://calls.example",
      participantToken: "short-token",
    };
    const { command, invoke } = service({ data: { connection }, error: null });
    await expect(command.checkMedia("lesson-1"))
      .resolves.toEqual({ ok: true, connection });
    expect(invoke).toHaveBeenCalledWith("call-command", {
      body: { action: "checkMedia", lessonId: "lesson-1" },
      timeout: 15_000,
    });
  });

  it("preserves calm Edge Function recovery copy", async () => {
    const context = new Response(JSON.stringify({
      code: "media_check_not_allowed",
      error: "This lesson is no longer available for a setup check.",
    }), { status: 403, headers: { "content-type": "application/json" } });
    const { command } = service({
      data: null,
      error: { context },
    });
    await expect(command.checkMedia("lesson-1")).resolves.toEqual({
      ok: false,
      code: "media_check_not_allowed",
      notice: "This lesson is no longer available for a setup check.",
    });
  });
});
