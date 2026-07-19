import { PRESENCE_IDLE_MS } from "@fish/core/presence";

export type HeartbeatLifecycleEvent = "activity" | "visible" | "online";

export function heartbeatRetryDelay(attempt: number): number {
  return [5_000, 10_000, 30_000][Math.min(Math.max(attempt, 0), 2)] ?? 30_000;
}

export function shouldWriteAfterActivity(
  event: HeartbeatLifecycleEvent,
  nowMs: number,
  lastActivityAt: number,
  idleMs = PRESENCE_IDLE_MS
): boolean {
  if (event === "online") return true;
  return nowMs - lastActivityAt >= idleMs;
}

export function heartbeatActivityState(
  event: HeartbeatLifecycleEvent,
  nowMs: number,
  lastActivityAt: number,
  idleMs = PRESENCE_IDLE_MS
) {
  return {
    nextActivityAt: nowMs,
    shouldWrite: shouldWriteAfterActivity(event, nowMs, lastActivityAt, idleMs),
    incrementsActivityVersion: true,
  };
}
