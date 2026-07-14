import type { CallCommandService } from "@/lib/services";

export async function closeFailedMediaConnection(
  callId: string,
  commands: Pick<CallCommandService, "end">,
  disconnect: () => Promise<void>
): Promise<void> {
  await disconnect().catch(() => undefined);
  await commands.end(callId).catch(() => undefined);
}
