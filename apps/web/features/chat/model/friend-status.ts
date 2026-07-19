import type {
  ClientFriendRequest,
  FriendCandidate,
  FriendCommandResult,
} from "@/lib/services";

export type FriendStatusTransition =
  | { type: "candidate"; candidate: FriendCandidate }
  | { type: "refresh" }
  | { type: "notice"; notice: string };

export function nextCandidateStatus(
  candidate: FriendCandidate,
  result: FriendCommandResult<ClientFriendRequest>
): FriendStatusTransition {
  if (!result.ok) {
    if (result.code === "request_pending") {
      return { type: "candidate", candidate: { ...candidate, status: "outgoingPending" } };
    }
    if (result.code === "already_friends") {
      return { type: "candidate", candidate: { ...candidate, status: "friends" } };
    }
    if (result.code === "incoming_request_exists") return { type: "refresh" };
    return { type: "notice", notice: result.notice };
  }

  const status = result.data.status === "accepted"
    ? "friends"
    : result.data.status === "pending"
      ? "outgoingPending"
      : "unavailable";
  return { type: "candidate", candidate: { ...candidate, status } };
}
