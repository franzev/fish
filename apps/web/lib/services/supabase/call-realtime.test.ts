import type { CallRow } from "@fish/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return {
    client: {
      from: vi.fn(() => query),
      rpc: vi.fn(),
    },
    query,
  };
});

vi.mock("./browser", () => ({
  createBrowserSupabaseClient: () => runtime.client,
}));

import { supabaseCallRealtimeService } from "./call-realtime";

const call: CallRow = {
  accepted_at: null,
  client_id: "22222222-2222-4222-8222-222222222222",
  client_request_id: "request-1",
  coach_id: "11111111-1111-4111-8111-111111111111",
  connected_at: null,
  created_at: "2026-07-15T04:00:00.000Z",
  end_reason: null,
  ended_at: null,
  ended_by: null,
  expires_at: "2026-07-15T04:01:00.000Z",
  id: "33333333-3333-4333-8333-333333333333",
  initiated_by: "11111111-1111-4111-8111-111111111111",
  kind: "video",
  lesson_slot_id: null,
  provider: "livekit",
  provider_room_name: "call-room-1",
  relationship_kind: "friend",
  status: "ringing",
  updated_at: "2026-07-15T04:00:00.000Z",
};

describe("supabaseCallRealtimeService", () => {
  beforeEach(() => {
    runtime.client.from.mockClear();
    runtime.client.rpc.mockReset();
    runtime.query.maybeSingle.mockReset();
  });

  it("loads the participant-scoped counterpart name for an incoming call", async () => {
    runtime.query.maybeSingle.mockResolvedValue({ data: call, error: null });
    runtime.client.rpc.mockResolvedValue({ data: "Patty Cake", error: null });

    const result = await supabaseCallRealtimeService.findCall(
      call.id,
      call.client_id
    );

    expect(runtime.client.rpc).toHaveBeenCalledWith(
      "get_call_counterpart_name",
      { p_call_id: call.id }
    );
    expect(result?.counterpartName).toBe("Patty Cake");
  });
});
