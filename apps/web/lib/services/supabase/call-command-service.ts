"use client";

import type {
  CallCommandResult,
  CallCommandService,
  CallConnection,
  ClientCall,
} from "../contracts";
import type { AppSupabaseClient } from "./types";

type CommandResponse = {
  call?: ClientCall;
  connection?: CallConnection;
  code?: string;
  error?: string;
};

export class SupabaseCallCommandService implements CallCommandService {
  constructor(private readonly client: AppSupabaseClient) {}

  initiate(input: {
    recipientId: string;
    kind: "audio" | "video";
    clientRequestId: string;
  }) {
    return this.invoke({ action: "initiate", ...input });
  }

  accept(callId: string) {
    return this.invoke({ action: "accept", callId });
  }

  reject(callId: string) {
    return this.invoke({ action: "reject", callId });
  }

  cancel(callId: string) {
    return this.invoke({ action: "cancel", callId });
  }

  end(callId: string) {
    return this.invoke({ action: "end", callId });
  }

  join(callId: string) {
    return this.invoke({ action: "join", callId });
  }

  private async invoke(body: Record<string, unknown>): Promise<CallCommandResult> {
    const result = await this.client.functions.invoke<CommandResponse>(
      "call-command",
      { body, timeout: 15_000 }
    );
    if (!result.error && result.data?.call) {
      return {
        ok: true,
        call: result.data.call,
        ...(result.data.connection
          ? { connection: result.data.connection }
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
      code: payload?.code ?? "call_unavailable",
      notice:
        payload?.error ??
        "Calling is taking a break. Messages still work.",
    };
  }
}
