"use client";

import type {
  CallCommandResult,
  CallCommandService,
  CallConnection,
  ClientCall,
  MediaCheckCommandResult,
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

  initiateLesson(input: {
    lessonId: string;
    clientRequestId: string;
  }) {
    return this.invoke({ action: "initiateLesson", ...input });
  }

  async checkMedia(lessonId: string): Promise<MediaCheckCommandResult> {
    const result = await this.request({ action: "checkMedia", lessonId });
    if (!result.ok) return result;
    if (!result.payload.connection) {
      return {
        ok: false,
        code: "media_unavailable",
        notice: "We couldn’t check the call connection right now. Your camera and microphone check still works.",
      };
    }
    return { ok: true, connection: result.payload.connection };
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
    const result = await this.request(body);
    if (!result.ok) return result;
    if (result.payload.call) {
      return {
        ok: true,
        call: result.payload.call,
        ...(result.payload.connection
          ? { connection: result.payload.connection }
          : {}),
      };
    }
    return {
      ok: false,
      code: "call_unavailable",
      notice: "Calling is taking a break. Messages still work.",
    };
  }

  private async request(body: Record<string, unknown>): Promise<
    | { ok: true; payload: CommandResponse }
    | { ok: false; code: string; notice: string }
  > {
    const result = await this.client.functions.invoke<CommandResponse>(
      "call-command",
      { body, timeout: 15_000 }
    );
    if (!result.error && result.data) {
      return { ok: true, payload: result.data };
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
