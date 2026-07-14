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
  CallRealtimeService,
  ClientCall,
} from "@/lib/services";
import type { RemoteVideoTrack } from "livekit-client";
import { usePathname, useRouter } from "next/navigation";
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
  closeCallForNavigation,
  closeFailedMediaConnection,
} from "./call-exit";

interface CallContextValue {
  state: CallState;
  homeHref: "/home" | "/coach";
  notice: string | null;
  busy: boolean;
  audioBlocked: boolean;
  localMicrophoneActive: boolean;
  remoteSpeaking: boolean;
  localVideoStream: MediaStream | null;
  remoteVideoTrack: RemoteVideoTrack | null;
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
  loadCall(callId: string): Promise<void>;
  leaveSurface(): void;
  clear(): void;
  microphones(): Promise<AudioDeviceOption[]>;
  switchMicrophone(deviceId: string): Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

interface CallProviderProps {
  userId: string;
  homeHref?: "/home" | "/coach";
  children: React.ReactNode;
  commands?: CallCommandService;
  realtime?: CallRealtimeService;
}

export function CallProvider({
  userId,
  homeHref = "/home",
  children,
  commands: commandsOverride,
  realtime: realtimeOverride,
}: CallProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
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
    remoteSpeaking: false,
  });
  const [localVideoStream, setLocalVideoStream] =
    useState<MediaStream | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] =
    useState<RemoteVideoTrack | null>(null);
  const stateRef = useRef(state);
  const previousPathnameRef = useRef(pathname);
  const ignoredCallIdsRef = useRef(new Set<string>());
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
  const [media] = useState(() =>
    new LiveKitCallMedia({
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
      onLocalVideoChanged(stream) {
        setLocalVideoStream(stream);
      },
      onRemoteVideoChanged(track) {
        setRemoteVideoTrack(track);
      },
      onCameraChanged(enabled) {
        dispatch({ type: "cameraChanged", enabled });
      },
    })
  );

  const applyCall = useCallback((call: ClientCall, counterpartName: string) => {
    const counterpartId = call.coachId === userId ? call.clientId : call.coachId;
    if (call.status === "ringing") {
      dispatch({
        type: call.initiatedBy === userId
          ? "outgoingCallCreated"
          : "incomingCallReceived",
        callId: call.id,
        counterpartId,
        counterpartName,
        kind: call.kind,
        expiresAt: call.expiresAt,
      });
      return;
    }
    if (call.status === "connecting" || call.status === "active") {
      if (stateRef.current.current.callId !== call.id) {
        dispatch({
          type: call.initiatedBy === userId
            ? "outgoingCallCreated"
            : "incomingCallReceived",
          callId: call.id,
          counterpartId,
          counterpartName,
          kind: call.kind,
          expiresAt: call.expiresAt,
        });
      }
      dispatch({ type: "callAccepted", callId: call.id });
      if (call.status === "active") {
        dispatch({
          type: "mediaConnected",
          callId: call.id,
          connectedAt: call.connectedAt ?? new Date().toISOString(),
        });
      }
      return;
    }

    if (stateRef.current.current.callId !== call.id) {
      dispatch({
        type: call.initiatedBy === userId
          ? "outgoingCallCreated"
          : "incomingCallReceived",
        callId: call.id,
        counterpartId,
        counterpartName,
        kind: call.kind,
        expiresAt: call.expiresAt,
      });
    }
    const event = call.status === "rejected"
      ? "callRejected"
      : call.status === "cancelled"
      ? "callCancelled"
      : call.status === "missed"
      ? "callMissed"
      : call.status === "ended"
      ? "callEnded"
      : null;
    if (event) dispatch({ type: event, callId: call.id });
    else dispatch({ type: "callFailed", callId: call.id, reason: "connectFailed" });
    void media.disconnect();
  }, [media, userId]);

  const failMediaConnection = useCallback(async (callId: string) => {
    await closeFailedMediaConnection(callId, commands, () => media.disconnect());
    dispatch({ type: "callFailed", callId, reason: "connectFailed" });
    setNotice("The call didn’t connect. Messages still work.");
  }, [commands, media]);

  const loadCall = useCallback(async (callId: string) => {
    const found = await realtime.findCall(callId, userId);
    if (!found) {
      setNotice("This call is no longer available.");
      dispatch({ type: "callFailed", reason: "notAllowed" });
      return;
    }
    applyCall(found.call, found.counterpartName);
    if (["connecting", "active"].includes(found.call.status)) {
      const joined = await commands.join(found.call.id);
      if (joined.ok && joined.connection) {
        try {
          await media.connect(found.call.id, joined.connection, {
            microphone: true,
            camera: found.call.kind === "video",
          });
        } catch {
          await failMediaConnection(found.call.id);
        }
      } else if (joined.ok) {
        await failMediaConnection(found.call.id);
      } else {
        setNotice(joined.notice);
      }
    }
  }, [applyCall, commands, failMediaConnection, media, realtime, userId]);

  useEffect(() => {
    let active = true;
    const recover = () => {
      const currentCallId = stateRef.current.current.callId;
      if (currentCallId && ignoredCallIdsRef.current.has(currentCallId)) return;
      const lookup = currentCallId
        ? realtime.findCall(currentCallId, userId)
        : realtime.findCurrentCall(userId);
      void lookup.then((found) => {
        if (!active || !found) return;
        applyCall(found.call, found.counterpartName);
        router.push(`/calls/${found.call.id}`);
      });
    };
    const unsubscribe = realtime.subscribe(userId, (event) => {
      if (ignoredCallIdsRef.current.has(event.callId)) return;
      void realtime.findCall(event.callId, userId).then((found) => {
        if (!active || !found) return;
        applyCall(found.call, found.counterpartName);
        if (
          found.call.status === "connecting" &&
          found.call.initiatedBy === userId
        ) {
          void commands.join(found.call.id).then(async (joined) => {
            if (joined.ok && joined.connection) {
              try {
                await media.connect(
                  found.call.id,
                  joined.connection,
                  {
                    microphone: true,
                    camera: found.call.kind === "video",
                  }
                );
              } catch {
                await failMediaConnection(found.call.id);
              }
              return;
            }
            if (joined.ok) {
              await failMediaConnection(found.call.id);
              return;
            }
            setNotice(
              joined.notice
            );
          }).catch(() => {
            void failMediaConnection(found.call.id);
          });
        }
        if (
          found.call.initiatedBy !== userId &&
          found.call.status === "ringing"
        ) {
          router.push(`/calls/${found.call.id}`);
        }
      });
    }, recover);
    recover();
    return () => {
      active = false;
      unsubscribe();
      dispatch({ type: "identityChanged" });
      void media.disconnect();
    };
  }, [applyCall, commands, failMediaConnection, media, realtime, router, userId]);

  const leaveSurface = useCallback(() => {
    void media.disconnect();
  }, [media]);

  useEffect(() => {
    const handlePageHide = () => leaveSurface();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [leaveSurface]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    if (!previousPathname.startsWith("/calls/") || pathname.startsWith("/calls/")) {
      return;
    }

    const call = stateRef.current.current;
    if (!call.callId) {
      leaveSurface();
      dispatch({ type: "clearCall" });
      return;
    }

    ignoredCallIdsRef.current.add(call.callId);
    void closeCallForNavigation(call, commands, leaveSurface)
      .catch(() => undefined)
      .finally(() => dispatch({ type: "clearCall" }));
  }, [commands, leaveSurface, pathname]);

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

  const value = useMemo<CallContextValue>(() => ({
    state,
    homeHref,
    notice,
    busy,
    audioBlocked,
    localMicrophoneActive: speaking.localMicrophoneActive,
    remoteSpeaking: speaking.remoteSpeaking,
    localVideoStream,
    remoteVideoTrack,
    startCall: async (recipientId, recipientName, kind) => run(async () => {
      if (selectHasLiveCall(stateRef.current)) {
        setNotice("Finish the current call before starting another one.");
        return;
      }
      dispatch({
        type: "permissionRequested",
        counterpartId: recipientId,
        counterpartName: recipientName,
        kind,
      });
      const permission = await requestMediaPermission(kind);
      if (permission !== "granted") {
        dispatch({
          type: "permissionDenied",
          reason: permission === "denied"
            ? "permissionDenied"
            : "deviceUnavailable",
        });
        setNotice(
          permission === "denied"
            ? kind === "video"
              ? "Allow camera and microphone access, then try the video call again."
              : "Allow microphone access in your browser, then try the call again."
            : kind === "video"
            ? "We couldn’t find a camera and microphone. Check your devices and try again."
            : "We couldn’t find a microphone. Check your device and try again."
        );
        return;
      }
      const result = await commands.initiate({
        recipientId,
        kind,
        clientRequestId: crypto.randomUUID(),
      });
      if (!result.ok) {
        dispatch({ type: "callFailed", reason: "providerUnavailable" });
        setNotice(result.notice);
        return;
      }
      dispatch({
        type: "outgoingCallCreated",
        callId: result.call.id,
        counterpartId: recipientId,
        counterpartName: recipientName,
        kind,
        expiresAt: result.call.expiresAt,
      });
      router.push(`/calls/${result.call.id}`);
    }),
    startLessonCall: async (lessonId, coachId, coachName) => run(async () => {
      if (selectHasLiveCall(stateRef.current)) {
        setNotice("Finish the current call before joining your lesson.");
        return;
      }
      dispatch({
        type: "permissionRequested",
        counterpartId: coachId,
        counterpartName: coachName,
        kind: "video",
      });
      const permission = await requestMediaPermission("video");
      if (permission !== "granted") {
        dispatch({
          type: "permissionDenied",
          reason: permission === "denied"
            ? "permissionDenied"
            : "deviceUnavailable",
        });
        setNotice(
          permission === "denied"
            ? "Allow camera and microphone access, then join your lesson again."
            : "We couldn’t find a camera and microphone. Check your devices and try again."
        );
        return;
      }
      const result = await commands.initiateLesson({
        lessonId,
        clientRequestId: crypto.randomUUID(),
      });
      if (!result.ok) {
        dispatch({ type: "callFailed", reason: "providerUnavailable" });
        setNotice(result.notice);
        return;
      }
      dispatch({
        type: "outgoingCallCreated",
        callId: result.call.id,
        counterpartId: coachId,
        counterpartName: coachName,
        kind: "video",
        expiresAt: result.call.expiresAt,
      });
      router.push(`/calls/${result.call.id}`);
    }),
    answer: async () => run(async () => {
      const callId = stateRef.current.current.callId;
      if (!callId) return;
      const callKind = stateRef.current.current.kind;
      const permission = await requestMediaPermission(callKind);
      if (permission !== "granted") {
        setNotice(
          callKind === "video"
            ? "Allow camera and microphone access, then answer again."
            : "Allow microphone access in your browser, then answer again."
        );
        return;
      }
      const result = await commands.accept(callId);
      if (!result.ok || !result.connection) {
        if (result.ok) await failMediaConnection(callId);
        else setNotice(result.notice);
        return;
      }
      dispatch({ type: "callAccepted", callId });
      try {
        await media.connect(callId, result.connection, {
          microphone: true,
          camera: callKind === "video",
        });
      } catch {
        await failMediaConnection(callId);
      }
    }),
    decline: async () => run(async () => {
      const callId = stateRef.current.current.callId;
      if (!callId) return;
      const result = await commands.reject(callId);
      if (!result.ok) setNotice(result.notice);
      else dispatch({ type: "callRejected", callId });
      await media.disconnect();
    }),
    cancel: async () => run(async () => {
      const callId = stateRef.current.current.callId;
      if (!callId) return;
      const result = await commands.cancel(callId);
      if (!result.ok) setNotice(result.notice);
      else dispatch({ type: "callCancelled", callId });
      await media.disconnect();
    }),
    end: async () => run(async () => {
      const callId = stateRef.current.current.callId;
      if (!callId) return;
      const result = await commands.end(callId);
      if (!result.ok) setNotice(result.notice);
      else dispatch({ type: "callEnded", callId });
      await media.disconnect();
    }),
    toggleMute: async () => {
      const muted = !stateRef.current.current.muted;
      await media.setMuted(muted);
      if (muted) {
        setSpeaking((current) => ({
          ...current,
          localMicrophoneActive: false,
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
    loadCall,
    leaveSurface,
    clear: () => {
      setNotice(null);
      setAudioBlocked(false);
      setSpeaking({
        localMicrophoneActive: false,
        remoteSpeaking: false,
      });
      setLocalVideoStream(null);
      setRemoteVideoTrack(null);
      dispatch({ type: "clearCall" });
    },
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
  }), [audioBlocked, busy, commands, failMediaConnection, homeHref, leaveSurface, loadCall, localVideoStream, media, notice, remoteVideoTrack, router, run, speaking, state]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const value = useContext(CallContext);
  if (!value) throw new Error("useCall must be used inside CallProvider");
  return value;
}
