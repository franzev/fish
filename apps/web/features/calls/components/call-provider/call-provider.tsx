"use client";

import {
  createEmptyCallState,
  reduceCallState,
  selectHasLiveCall,
  type CallKind,
  type CallState,
} from "@fish/core/call-state";
import {
  getCallCommandService,
  getCallRealtimeService,
} from "@/lib/services/runtime/browser";
import type {
  CallCommandService,
  CallCommandResult,
  CallRealtimeService,
  ClientCall,
} from "@/lib/services";
import type { RemoteVideoTrack } from "livekit-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  LiveKitCallMedia,
  requestMediaPermission,
  type AudioDeviceOption,
} from "../../client/call-media";
import {
  readVideoQualityPreference,
  writeVideoQualityPreference,
  type VideoQualityPreference,
} from "../../client/video-quality-preference";
import {
  closeFailedMediaConnection,
} from "./call-exit";
import { planCallEvents } from "./apply-call";
import { permissionNotice } from "./permission-notice";

export interface CallContextValue {
  state: CallState;
  notice: string | null;
  busy: boolean;
  audioBlocked: boolean;
  localMicrophoneActive: boolean;
  localMicrophoneLevel: number;
  remoteSpeaking: boolean;
  remoteMicrophoneLevel: number;
  remoteMuted: boolean;
  localVideoStream: MediaStream | null;
  remoteVideoTrack: RemoteVideoTrack | null;
  videoQualityPreference: VideoQualityPreference;
  startCall(
    recipientId: string,
    recipientName: string,
    kind: CallKind
  ): Promise<void>;
  startLessonCall(
    lessonId: string,
    coachId: string,
    coachName: string
  ): Promise<void>;
  answer(): Promise<void>;
  decline(): Promise<void>;
  cancel(): Promise<void>;
  end(): Promise<void>;
  toggleMute(): Promise<void>;
  toggleCamera(): Promise<void>;
  hearCall(): Promise<void>;
  clear(): void;
  microphones(): Promise<AudioDeviceOption[]>;
  switchMicrophone(deviceId: string): Promise<void>;
  setVideoQualityPreference(preference: VideoQualityPreference): void;
}

export type CallMedia = Pick<
  LiveKitCallMedia,
  | "connect"
  | "disconnect"
  | "setMuted"
  | "setCameraEnabled"
  | "startAudio"
  | "microphones"
  | "switchMicrophone"
  | "setVideoQualityPreference"
>;

const CallContext = createContext<CallContextValue | null>(null);

interface CallProviderProps {
  userId: string;
  children: React.ReactNode;
  commands?: CallCommandService;
  realtime?: CallRealtimeService;
  media?: CallMedia;
  requestPermission?: (
    kind: CallKind
  ) => Promise<Awaited<ReturnType<typeof requestMediaPermission>>>;
}

export function CallProvider({
  userId,
  children,
  commands: commandsOverride,
  realtime: realtimeOverride,
  media: mediaOverride,
  requestPermission: requestPermissionOverride,
}: CallProviderProps) {
  const [state, dispatch] = useReducer(
    reduceCallState,
    undefined,
    createEmptyCallState
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [speaking, setSpeaking] = useState({
    localMicrophoneActive: false,
    localMicrophoneLevel: 0,
    remoteSpeaking: false,
    remoteMicrophoneLevel: 0,
  });
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [localVideoStream, setLocalVideoStream] =
    useState<MediaStream | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] =
    useState<RemoteVideoTrack | null>(null);
  const [videoQualityPreference, setVideoQualityPreferenceState] =
    useState<VideoQualityPreference>(readVideoQualityPreference);
  const stateRef = useRef(state);
  const connectedCallIdRef = useRef<string | null>(null);
  const connectionAttemptsRef = useRef(new Map<string, Promise<void>>());
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const commands = useMemo(
    () => getCallCommandService(commandsOverride),
    [commandsOverride]
  );
  const realtime = useMemo(
    () => getCallRealtimeService(realtimeOverride),
    [realtimeOverride]
  );
  const [media] = useState<CallMedia>(() =>
    mediaOverride ?? new LiveKitCallMedia(
      {
        onConnected(callId) {
          dispatch({
            type: "mediaConnected",
            callId,
            connectedAt: new Date().toISOString(),
          });
        },
        onReconnecting(callId) {
          dispatch({ type: "reconnecting", callId });
        },
        onReconnected(callId) {
          dispatch({ type: "reconnected", callId });
        },
        onDisconnected(callId) {
          dispatch({ type: "callFailed", callId, reason: "networkLost" });
        },
        onAudioPlaybackChanged(blocked) {
          setAudioBlocked(blocked);
        },
        onSpeakingChanged(_callId, speakingState) {
          setSpeaking(speakingState);
        },
        onRemoteMuteChanged(_callId, muted) {
          setRemoteMuted(muted);
        },
        onLocalVideoChanged(stream) {
          setLocalVideoStream(stream);
        },
        onRemoteVideoChanged(track) {
          setRemoteVideoTrack(track);
        },
        onCameraChanged(enabled) {
          dispatch({ type: "cameraChanged", enabled });
        },
      },
      videoQualityPreference
    )
  );

  useEffect(() => {
    if (!selectHasLiveCall(state)) {
      connectedCallIdRef.current = null;
    }
  }, [state]);

  const applyCall = useCallback((call: ClientCall, counterpartName: string) => {
    const plan = planCallEvents(call, stateRef.current, {
      userId,
      counterpartName,
    });
    plan.events.forEach((event) => dispatch(event));
    if (plan.shouldDisconnect) {
      if (connectedCallIdRef.current === call.id) {
        connectedCallIdRef.current = null;
      }
      void media.disconnect();
    }
  }, [media, userId]);

  const failMediaConnection = useCallback(async (callId: string) => {
    if (connectedCallIdRef.current === callId) {
      connectedCallIdRef.current = null;
    }
    await closeFailedMediaConnection(callId, commands, () => media.disconnect());
    dispatch({ type: "callFailed", callId, reason: "connectFailed" });
    setNotice("The call didn’t connect. Messages still work.");
  }, [commands, media]);

  const connectCall = useCallback((
    call: Pick<ClientCall, "id" | "kind">,
    connectCommand: () => Promise<CallCommandResult> = () => commands.join(call.id),
    onConnected?: () => void,
  ): Promise<void> => {
    if (connectedCallIdRef.current === call.id) {
      return Promise.resolve();
    }

    const activeAttempt = connectionAttemptsRef.current.get(call.id);
    if (activeAttempt) return activeAttempt;

    const attempt = (async () => {
      const joined = await connectCommand();
      if (joined.ok && joined.connection) {
        onConnected?.();
        try {
          await media.connect(call.id, joined.connection, {
            microphone: true,
            camera: call.kind === "video",
          });
          connectedCallIdRef.current = call.id;
        } catch {
          await failMediaConnection(call.id);
        }
        return;
      }
      if (joined.ok) {
        await failMediaConnection(call.id);
        return;
      }
      setNotice(joined.notice);
    })().catch(() => failMediaConnection(call.id)).finally(() => {
      if (connectionAttemptsRef.current.get(call.id) === attempt) {
        connectionAttemptsRef.current.delete(call.id);
      }
    });

    connectionAttemptsRef.current.set(call.id, attempt);
    return attempt;
  }, [commands, failMediaConnection, media]);

  const loadCall = useCallback(async (callId: string) => {
    const found = await realtime.findCall(callId, userId);
    if (!found) {
      setNotice("This call is no longer available.");
      dispatch({ type: "callFailed", reason: "notAllowed" });
      return;
    }
    applyCall(found.call, found.counterpartName);
    if (["connecting", "active"].includes(found.call.status)) {
      await connectCall(found.call);
    }
  }, [applyCall, connectCall, realtime, userId]);

  useEffect(() => {
    let active = true;
    const connectionAttempts = connectionAttemptsRef.current;
    const recover = () => {
      const currentCallId = stateRef.current.current.callId;
      const lookup = currentCallId
        ? realtime.findCall(currentCallId, userId)
        : realtime.findCurrentCall(userId);
      void lookup.then((found) => {
        if (!active || !found) return;
        void loadCall(found.call.id);
      });
    };
    const unsubscribe = realtime.subscribe(userId, (event) => {
      void realtime.findCall(event.callId, userId).then((found) => {
        if (!active || !found) return;
        applyCall(found.call, found.counterpartName);
        if (
          found.call.status === "connecting" &&
          found.call.initiatedBy === userId
        ) {
          void connectCall(found.call);
        }
      });
    }, recover);
    recover();
    return () => {
      active = false;
      unsubscribe();
      connectedCallIdRef.current = null;
      connectionAttempts.clear();
      dispatch({ type: "identityChanged" });
      void media.disconnect();
    };
  }, [applyCall, connectCall, loadCall, media, realtime, userId]);

  const disconnectMedia = useCallback(() => {
    void media.disconnect();
  }, [media]);

  useEffect(() => {
    const handlePageHide = () => disconnectMedia();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [disconnectMedia]);

  const clearCall = useCallback(() => {
    setNotice(null);
    setAudioBlocked(false);
    setSpeaking({
      localMicrophoneActive: false,
      localMicrophoneLevel: 0,
      remoteSpeaking: false,
      remoteMicrophoneLevel: 0,
    });
    setRemoteMuted(false);
    setLocalVideoStream(null);
    setRemoteVideoTrack(null);
    dispatch({ type: "clearCall" });
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch {
      const callId = stateRef.current.current.callId ?? undefined;
      dispatch({ type: "callFailed", callId, reason: "connectFailed" });
      setNotice("The call didn’t connect. Messages still work.");
      await media.disconnect();
    } finally {
      setBusy(false);
    }
  }, [busy, media]);

  const startCallFlow = useCallback(
    (input: {
      kind: CallKind;
      counterpartId: string;
      counterpartName: string;
      permissionFlow: "call" | "lesson";
      busyNotice: string;
      initiate: () => Promise<CallCommandResult>;
    }) => run(async () => {
      if (selectHasLiveCall(stateRef.current)) {
        setNotice(input.busyNotice);
        return;
      }
      dispatch({
        type: "permissionRequested",
        counterpartId: input.counterpartId,
        counterpartName: input.counterpartName,
        kind: input.kind,
      });
      const permission = await (requestPermissionOverride ?? requestMediaPermission)(input.kind);
      if (permission !== "granted") {
        const denial = permissionNotice(input.kind, permission, input.permissionFlow);
        dispatch({ type: "permissionDenied", reason: denial.reason });
        setNotice(denial.notice);
        return;
      }
      const result = await input.initiate();
      if (!result.ok) {
        dispatch({ type: "callFailed", reason: "providerUnavailable" });
        setNotice(result.notice);
        return;
      }
      dispatch({
        type: "outgoingCallCreated",
        callId: result.call.id,
        counterpartId: input.counterpartId,
        counterpartName: input.counterpartName,
        kind: input.kind,
        expiresAt: result.call.expiresAt,
      });
    }),
    [requestPermissionOverride, run]
  );

  const terminate = useCallback(
    async (
      command: "reject" | "cancel" | "end",
      eventType: "callRejected" | "callCancelled" | "callEnded"
    ) => run(async () => {
      const callId = stateRef.current.current.callId;
      if (!callId) return;
      const result = await commands[command](callId);
      if (!result.ok) setNotice(result.notice);
      else dispatch({ type: eventType, callId });
      await media.disconnect();
    }),
    [commands, media, run]
  );

  const value = useMemo<CallContextValue>(() => ({
    state,
    notice,
    busy,
    audioBlocked,
    localMicrophoneActive: speaking.localMicrophoneActive,
    localMicrophoneLevel: speaking.localMicrophoneLevel,
    remoteSpeaking: speaking.remoteSpeaking,
    remoteMicrophoneLevel: speaking.remoteMicrophoneLevel,
    remoteMuted,
    localVideoStream,
    remoteVideoTrack,
    videoQualityPreference,
    startCall: (recipientId, recipientName, kind) => startCallFlow({
      kind,
      counterpartId: recipientId,
      counterpartName: recipientName,
      permissionFlow: "call",
      busyNotice: "Finish the current call before starting another one.",
      initiate: () => commands.initiate({ recipientId, kind, clientRequestId: crypto.randomUUID() }),
    }),
    startLessonCall: (lessonId, coachId, coachName) => startCallFlow({
      kind: "video",
      counterpartId: coachId,
      counterpartName: coachName,
      permissionFlow: "lesson",
      busyNotice: "Finish the current call before joining your lesson.",
      initiate: () => commands.initiateLesson({ lessonId, clientRequestId: crypto.randomUUID() }),
    }),
    answer: async () => run(async () => {
      const callId = stateRef.current.current.callId;
      if (!callId) return;
      const callKind = stateRef.current.current.kind;
      const permission = await (requestPermissionOverride ?? requestMediaPermission)(callKind);
      if (permission !== "granted") {
        const denial = permissionNotice(callKind, permission, "answer");
        dispatch({ type: "permissionDenied", reason: denial.reason });
        setNotice(denial.notice);
        return;
      }
      await connectCall(
        { id: callId, kind: callKind },
        () => commands.accept(callId),
        () => dispatch({ type: "callAccepted", callId }),
      );
    }),
    decline: () => terminate("reject", "callRejected"),
    cancel: () => terminate("cancel", "callCancelled"),
    end: () => terminate("end", "callEnded"),
    toggleMute: async () => {
      const muted = !stateRef.current.current.muted;
      await media.setMuted(muted);
      if (muted) {
        setSpeaking((current) => ({
          ...current,
          localMicrophoneActive: false,
          localMicrophoneLevel: 0,
        }));
      }
      dispatch({ type: "muteChanged", muted });
    },
    toggleCamera: async () => {
      if (stateRef.current.current.kind !== "video") return;
      const enabled = !stateRef.current.current.cameraEnabled;
      try {
        await media.setCameraEnabled(enabled);
      } catch {
        setNotice(
          enabled
            ? "We couldn’t start your camera. Check its permission and try again."
            : "We couldn’t turn off your camera yet. Try again."
        );
      }
    },
    hearCall: async () => media.startAudio(),
    clear: clearCall,
    microphones: async () => {
      try {
        return await media.microphones();
      } catch {
        setNotice("We couldn’t read your microphones. The current one still works.");
        return [];
      }
    },
    switchMicrophone: async (deviceId) => {
      try {
        await media.switchMicrophone(deviceId);
      } catch {
        setNotice("That microphone isn’t available. The current one still works.");
      }
    },
    setVideoQualityPreference: (preference) => {
      setVideoQualityPreferenceState(preference);
      media.setVideoQualityPreference(preference);
      writeVideoQualityPreference(preference);
    },
  }), [audioBlocked, busy, clearCall, commands, connectCall, localVideoStream, media, notice, remoteMuted, remoteVideoTrack, requestPermissionOverride, run, speaking, state, startCallFlow, terminate, videoQualityPreference]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const value = useContext(CallContext);
  if (!value) throw new Error("useCall must be used inside CallProvider");
  return value;
}
