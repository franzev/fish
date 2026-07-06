import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const getSessionMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/lib/services/env", () => ({
  getPublicEnv: () => ({ supabaseUrl: "http://127.0.0.1:54321" }),
}));

vi.mock("@/lib/services/supabase/server", () => ({
  createServerSupabaseServices: async () => ({
    auth: { getCurrentUser: getCurrentUserMock },
    client: { auth: { getSession: getSessionMock } },
  }),
}));

vi.stubGlobal("fetch", fetchMock);

import { sendMessageAction } from "./actions";

const validInput = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  body: "  Hello coach  ",
  clientRequestId: "request-1",
};

function mockSignedIn() {
  getCurrentUserMock.mockResolvedValueOnce({
    ok: true,
    data: { id: "client-1" },
  });
  getSessionMock.mockResolvedValueOnce({
    data: { session: { access_token: "token-1" } },
    error: null,
  });
}

describe("sendMessageAction", () => {
  afterEach(() => {
    getCurrentUserMock.mockReset();
    getSessionMock.mockReset();
    fetchMock.mockReset();
  });

  it("returns a calm notice when signed out", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ ok: true, data: null });

    const result = await sendMessageAction(validInput);

    expect(result.status).toBe("notice");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects blank and oversized messages before fetch", async () => {
    mockSignedIn();

    const blank = await sendMessageAction({
      ...validInput,
      body: "   ",
    });

    expect(blank.status).toBe("notice");
    expect(blank.notice).toBe("Add a message before sending.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through the Edge Function with the bearer token", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          id: "message-1",
          conversation_id: validInput.conversationId,
          sender_id: "client-1",
          sender_role: "client",
          body: "Hello coach",
          client_request_id: "request-1",
          created_at: "2026-07-05T00:00:00.000Z",
        },
      }),
    });

    const result = await sendMessageAction(validInput);

    expect(result.status).toBe("sent");
    expect(result.message?.body).toBe("Hello coach");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/send-message",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
        body: JSON.stringify({
          conversationId: validInput.conversationId,
          body: "Hello coach",
          clientRequestId: "request-1",
        }),
      })
    );
  });

  it("returns the Edge Function notice on failed send", async () => {
    mockSignedIn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "That conversation is not available." }),
    });

    const result = await sendMessageAction(validInput);

    expect(result.status).toBe("notice");
    expect(result.notice).toBe("That conversation is not available.");
  });
});
