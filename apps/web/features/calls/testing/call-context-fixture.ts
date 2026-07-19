import {
  createEmptyCallState,
  type CallState,
} from "@fish/core/call-state";
import type { RemoteVideoTrack } from "livekit-client";
import type { CallContextValue } from "../components/call-provider";

export type CallFixtureSpy = <T extends (...args: never[]) => unknown>(implementation: T) => T;

const identitySpy: CallFixtureSpy = (implementation) => implementation;

export function makeCallContextValue(
  overrides: Partial<CallContextValue> = {},
  spy: CallFixtureSpy = identitySpy
): CallContextValue {
  const state: CallState = createEmptyCallState();
  state.current = {
    ...state.current,
    callId: "call-1",
    counterpartId: "client-1",
    counterpartName: "Franz",
    direction: "outgoing",
    status: "active",
  };

  return {
    state,
    notice: null,
    busy: false,
    audioBlocked: false,
    localMicrophoneActive: true,
    localMicrophoneLevel: 0.42,
    remoteSpeaking: false,
    remoteMicrophoneLevel: 0,
    remoteMuted: false,
    localVideoStream: null,
    remoteVideoTrack: null as RemoteVideoTrack | null,
    videoQualityPreference: "auto",
    startCall: spy(async () => undefined),
    startLessonCall: spy(async () => undefined),
    answer: spy(async () => undefined),
    decline: spy(async () => undefined),
    cancel: spy(async () => undefined),
    end: spy(async () => undefined),
    toggleMute: spy(async () => undefined),
    toggleCamera: spy(async () => undefined),
    hearCall: spy(async () => undefined),
    clear: spy(() => undefined),
    microphones: spy(async () => [
      { deviceId: "default", label: "Built-in microphone" },
      { deviceId: "usb", label: "USB microphone" },
    ]),
    switchMicrophone: spy(async () => undefined),
    setVideoQualityPreference: spy(() => undefined),
    ...overrides,
  };
}
