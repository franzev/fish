export interface FriendCommandError {
  code: string;
  error: string;
  status: number;
}

// Maps a friends RPC rejection message onto the calm {code, error} contract
// every client branches on. Matching is substring-based, so order is
// load-bearing: "report rate limited" must win before "rate limited", and
// "friends not available" before the generic "unavailable" fallback.
export function friendCommandError(message: string): FriendCommandError {
  const normalized = message.toLowerCase();
  if (normalized.includes("already friends")) {
    return { code: "already_friends", error: "You’re already friends.", status: 409 };
  }
  if (normalized.includes("incoming request exists")) {
    return {
      code: "incoming_request_exists",
      error: "They already sent you a request. Review it when you’re ready.",
      status: 409,
    };
  }
  if (normalized.includes("request pending")) {
    return {
      code: "request_pending",
      error: "Your request is already on its way.",
      status: 409,
    };
  }
  if (normalized.includes("already resolved")) {
    return {
      code: "request_already_resolved",
      error: "This request was already handled.",
      status: 409,
    };
  }
  if (normalized.includes("report rate limited")) {
    return {
      code: "rate_limited",
      error: "Give it a moment before reporting again.",
      status: 429,
    };
  }
  if (normalized.includes("rate limited")) {
    return {
      code: "rate_limited",
      error: "Pause for a moment before sending more requests.",
      status: 429,
    };
  }
  if (normalized.includes("conflicts")) {
    return {
      code: "request_conflict",
      error: "That friend request is already in progress.",
      status: 409,
    };
  }
  if (normalized.includes("friends not available")) {
    return {
      code: "friends_unavailable",
      error: "Friends isn’t available for this account.",
      status: 403,
    };
  }
  if (normalized.includes("request not found")) {
    return {
      code: "request_not_found",
      error: "This request isn’t available anymore.",
      status: 404,
    };
  }
  if (normalized.includes("unavailable") || normalized.includes("not found")) {
    return { code: "person_unavailable", error: "That person isn’t available.", status: 404 };
  }
  if (normalized.includes("not authenticated")) {
    return { code: "not_authenticated", error: "Sign in to manage friends.", status: 401 };
  }
  return {
    code: "friends_unavailable",
    error: "Friends is taking a break. Chat still works.",
    status: 503,
  };
}
