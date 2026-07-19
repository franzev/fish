import { describe, expect, it } from "vitest";
import { permissionNotice } from "./permission-notice";

describe("permissionNotice", () => {
  it.each([
    ["audio", "denied", "call", "permissionDenied", "Allow microphone access in your browser, then try the call again."],
    ["video", "denied", "lesson", "permissionDenied", "Allow camera and microphone access, then join your lesson."],
    ["audio", "unavailable", "answer", "deviceUnavailable", "We couldn’t find a microphone. Check your device and try again."],
  ] as const)("maps %s/%s/%s", (kind, result, flow, reason, notice) => {
    expect(permissionNotice(kind, result, flow)).toEqual({ reason, notice });
  });
});
