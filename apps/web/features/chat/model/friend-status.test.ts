import type { ClientFriendRequest, FriendCandidate } from "@/lib/services";
import { describe, expect, it } from "vitest";
import { nextCandidateStatus } from "./friend-status";

const candidate: FriendCandidate = {
  status: "none",
  profile: { id: "friend-1", displayName: "Alex", username: "alex" },
  requestId: null,
};
const request: ClientFriendRequest = {
  id: "request-1",
  senderId: "me",
  recipientId: "friend-1",
  status: "pending",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
  respondedAt: null,
};

describe("nextCandidateStatus", () => {
  it.each([
    [{ ok: false, code: "request_pending", notice: "pending" }, "outgoingPending"],
    [{ ok: false, code: "already_friends", notice: "friends" }, "friends"],
    [{ ok: true, data: { ...request, status: "accepted" } }, "friends"],
    [{ ok: true, data: request }, "outgoingPending"],
  ] as const)("maps a command outcome to %s", (result, status) => {
    const transition = nextCandidateStatus(candidate, result);
    expect(transition).toEqual({
      type: "candidate",
      candidate: { ...candidate, status },
    });
  });

  it("requests a relationship refresh when the server reports an incoming request", () => {
    expect(nextCandidateStatus(candidate, {
      ok: false,
      code: "incoming_request_exists",
      notice: "incoming",
    })).toEqual({ type: "refresh" });
  });
});
