"use client";

import type {
  PresenceCommandResult,
  PresenceCommandService,
  PresenceDurationSeconds,
  PresencePreference,
  PresencePreferenceSetting,
  PresenceSnapshot,
} from "../contracts";
import type { AppSupabaseClient } from "./types";

type CommandResponse = {
  snapshot?: PresenceSnapshot;
  setting?: PresencePreferenceSetting;
  code?: string;
  error?: string;
};

const fallbackNotice = "Your status could not change. Try again.";

export class SupabasePresenceCommandService implements PresenceCommandService {
  constructor(private readonly client: AppSupabaseClient) {}

  async setMode(
    mode: PresencePreference,
    durationSeconds: PresenceDurationSeconds | null = null
  ): Promise<PresenceCommandResult> {
    const result = await this.client.functions.invoke<CommandResponse>(
      "presence-command",
      { body: { mode, durationSeconds }, timeout: 15_000 }
    );
    if (!result.error && result.data?.snapshot && result.data.setting) {
      return {
        ok: true,
        snapshot: result.data.snapshot,
        setting: result.data.setting,
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
      code: payload?.code ?? "presence_unavailable",
      notice: payload?.error ?? fallbackNotice,
    };
  }
}
