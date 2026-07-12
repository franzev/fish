import type { CallSessionState } from "@fish/core/call-state";
import type { CallCommandService } from "@/lib/services";

export async function closeCallForNavigation(
  call: CallSessionState,
  commands: Pick<CallCommandService, "cancel" | "end" | "reject">,
  disconnect: () => void
): Promise<void> {
  disconnect();
  if (!call.callId) return;

  if (call.status === "ringing") {
    if (call.direction === "incoming") await commands.reject(call.callId);
    else await commands.cancel(call.callId);
    return;
  }

  if (["connecting", "active", "reconnecting"].includes(call.status)) {
    await commands.end(call.callId);
  }
}

export async function closeFailedMediaConnection(
  callId: string,
  commands: Pick<CallCommandService, "end">,
  disconnect: () => Promise<void>
): Promise<void> {
  await disconnect().catch(() => undefined);
  await commands.end(callId).catch(() => undefined);
}
