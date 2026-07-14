"use client";

import type {
  NotificationCommand,
  NotificationCommandResult,
  NotificationCommandService,
} from "../contracts";
import type { AppSupabaseClient } from "./types";

type CommandResponse = {
  updated?: number;
  archiveBatchId?: string;
  code?: string;
  error?: string;
};

const fallbackNotice = "Notifications could not update. Your messages are still here.";

export class SupabaseNotificationCommandService
  implements NotificationCommandService
{
  constructor(private readonly client: AppSupabaseClient) {}

  async execute(command: NotificationCommand): Promise<NotificationCommandResult> {
    const result = await this.client.functions.invoke<CommandResponse>(
      "notification-command",
      { body: command, timeout: 15_000 }
    );
    if (!result.error && result.data) {
      return {
        ok: true,
        updated: result.data.updated ?? 0,
        ...(result.data.archiveBatchId
          ? { archiveBatchId: result.data.archiveBatchId }
          : {}),
      };
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
      code: payload?.code ?? "notifications_unavailable",
      notice: payload?.error ?? fallbackNotice,
    };
  }
}
