import assert from "node:assert/strict";
import test from "node:test";
import { friendCommandError } from "./friend-command-errors.ts";

test("every named rejection keeps its code, copy, and status", () => {
  assert.deepEqual(friendCommandError("already friends"), {
    code: "already_friends",
    error: "You’re already friends.",
    status: 409,
  });
  assert.deepEqual(friendCommandError("incoming request exists"), {
    code: "incoming_request_exists",
    error: "They already sent you a request. Review it when you’re ready.",
    status: 409,
  });
  assert.deepEqual(friendCommandError("request pending"), {
    code: "request_pending",
    error: "Your request is already on its way.",
    status: 409,
  });
  assert.deepEqual(friendCommandError("request already resolved"), {
    code: "request_already_resolved",
    error: "This request was already handled.",
    status: 409,
  });
  assert.deepEqual(friendCommandError("friend request rate limited"), {
    code: "rate_limited",
    error: "Pause for a moment before sending more requests.",
    status: 429,
  });
  assert.deepEqual(
    friendCommandError("client request id conflicts with an existing friend request"),
    {
      code: "request_conflict",
      error: "That friend request is already in progress.",
      status: 409,
    },
  );
  assert.deepEqual(friendCommandError("friends not available"), {
    code: "friends_unavailable",
    error: "Friends isn’t available for this account.",
    status: 403,
  });
  assert.deepEqual(friendCommandError("request not found"), {
    code: "request_not_found",
    error: "This request isn’t available anymore.",
    status: 404,
  });
  assert.deepEqual(friendCommandError("person unavailable"), {
    code: "person_unavailable",
    error: "That person isn’t available.",
    status: 404,
  });
  assert.deepEqual(friendCommandError("not authenticated"), {
    code: "not_authenticated",
    error: "Sign in to manage friends.",
    status: 401,
  });
});

test("a report rate limit reads as a report, not a friend request", () => {
  assert.deepEqual(friendCommandError("report rate limited"), {
    code: "rate_limited",
    error: "Give it a moment before reporting again.",
    status: 429,
  });
});

test("substring ordering keeps specific phrases ahead of generic ones", () => {
  // "friends not available" contains neither "unavailable" nor "not found"
  // as decisive matches only because it is checked first; these prove the
  // generic person_unavailable fallback never shadows it.
  assert.equal(friendCommandError("friends not available").code, "friends_unavailable");
  assert.equal(friendCommandError("message not found").code, "person_unavailable");
  assert.equal(friendCommandError("request not found").code, "request_not_found");
});

test("anything unrecognized degrades to the one calm fallback line", () => {
  assert.deepEqual(friendCommandError("deadlock detected"), {
    code: "friends_unavailable",
    error: "Friends is taking a break. Chat still works.",
    status: 503,
  });
});
