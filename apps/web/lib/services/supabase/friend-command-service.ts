"use client";

import type {
  ClientFriendRequest,
  FriendCommandResult,
  FriendCommandService,
} from "../contracts";
import type { AppSupabaseClient } from "./types";

type CommandResponse = {
  request?: ClientFriendRequest;
  done?: boolean;
  updated?: number;
  code?: string;
  error?: string;
};

const fallbackNotice = "Friends is taking a break. Chat still works.";

export class SupabaseFriendCommandService implements FriendCommandService {
  constructor(private readonly client: AppSupabaseClient) {}

  sendRequest(input: { targetId: string; clientRequestId: string }) {
    return this.invokeForRequest({ action: "send-request", ...input });
  }

  respondRequest(input: {
    requestId: string;
    response: "accept" | "decline";
  }) {
    return this.invokeForRequest({ action: "respond-request", ...input });
  }

  cancelRequest(requestId: string) {
    return this.invokeForRequest({ action: "cancel-request", requestId });
  }

  async removeFriend(targetId: string): Promise<FriendCommandResult<void>> {
    const result = await this.invoke({ action: "remove-friend", targetId });
    return result.ok ? { ok: true, data: undefined } : result;
  }

  async blockUser(targetId: string): Promise<FriendCommandResult<void>> {
    const result = await this.invoke({ action: "block-user", targetId });
    return result.ok ? { ok: true, data: undefined } : result;
  }

  async unblockUser(targetId: string): Promise<FriendCommandResult<void>> {
    const result = await this.invoke({ action: "unblock-user", targetId });
    return result.ok ? { ok: true, data: undefined } : result;
  }

  async markNotificationsRead(
    notificationIds: string[]
  ): Promise<FriendCommandResult<number>> {
    const result = await this.invoke({
      action: "mark-notifications-read",
      notificationIds,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data.updated ?? 0 };
  }

  private async invokeForRequest(
    body: Record<string, unknown>
  ): Promise<FriendCommandResult<ClientFriendRequest>> {
    const result = await this.invoke(body);
    if (!result.ok) return result;
    if (!result.data.request) {
      return { ok: false, code: "friends_unavailable", notice: fallbackNotice };
    }
    return { ok: true, data: result.data.request };
  }

  private async invoke(
    body: Record<string, unknown>
  ): Promise<FriendCommandResult<CommandResponse>> {
    const result = await this.client.functions.invoke<CommandResponse>(
      "friend-command",
      { body, timeout: 15_000 }
    );
    if (!result.error && result.data) {
      return { ok: true, data: result.data };
    }

    let payload = result.data;
    const context = result.error && "context" in result.error
      ? result.error.context
      : null;
    if (context instanceof Response) {
      payload = await context.json().catch(() => null) as CommandResponse | null;
    }
    return {
      ok: false,
      code: payload?.code ?? "friends_unavailable",
      notice: payload?.error ?? fallbackNotice,
    };
  }
}
