import type { CallContextValue } from "../call-provider";
import type { CallPopoverViewProps } from "./call-popover-view";

type ViewOverrides = Pick<
  CallPopoverViewProps,
  "openChat" | "openingChat" | "chatSidebar" | "chatOpen" | "presentation"
>;

export function toCallPopoverViewProps(
  context: CallContextValue,
  overrides: ViewOverrides
): CallPopoverViewProps {
  return {
    call: context.state.current,
    ...overrides,
    notice: context.notice,
    busy: context.busy,
    audioBlocked: context.audioBlocked,
    localMicrophoneActive: context.localMicrophoneActive,
    localMicrophoneLevel: context.localMicrophoneLevel,
    remoteSpeaking: context.remoteSpeaking,
    remoteMicrophoneLevel: context.remoteMicrophoneLevel,
    remoteMuted: context.remoteMuted,
    localVideoStream: context.localVideoStream,
    remoteVideoTrack: context.remoteVideoTrack,
    videoQualityPreference: context.videoQualityPreference,
    answer: context.answer,
    decline: context.decline,
    cancel: context.cancel,
    end: context.end,
    toggleMute: context.toggleMute,
    toggleCamera: context.toggleCamera,
    hearCall: context.hearCall,
    microphones: context.microphones,
    switchMicrophone: context.switchMicrophone,
    setVideoQualityPreference: context.setVideoQualityPreference,
  };
}
