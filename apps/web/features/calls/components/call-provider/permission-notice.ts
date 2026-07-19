import type { CallKind } from "@fish/core/call-state";

export type PermissionResult = "granted" | "denied" | "unavailable";
export type PermissionFlow = "call" | "lesson" | "answer";

export interface PermissionNotice {
  reason: "permissionDenied" | "deviceUnavailable";
  notice: string;
}

export function permissionNotice(
  kind: CallKind,
  result: Exclude<PermissionResult, "granted">,
  flow: PermissionFlow
): PermissionNotice {
  const subject = flow === "lesson" ? "join your lesson" : flow === "answer" ? "answer again" : "try the call again";
  if (result === "denied") {
    return {
      reason: "permissionDenied",
      notice:
        kind === "video"
          ? `Allow camera and microphone access, then ${subject}.`
          : `Allow microphone access in your browser, then ${subject}.`,
    };
  }
  return {
    reason: "deviceUnavailable",
    notice:
      kind === "video"
        ? "We couldn’t find a camera and microphone. Check your devices and try again."
        : "We couldn’t find a microphone. Check your device and try again.",
  };
}
