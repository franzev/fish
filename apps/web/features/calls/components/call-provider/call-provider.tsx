"use client";

import {
  createEmptyCallState,
  reduceCallState,
  selectHasLiveCall,
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
import { useRouter } from "next/navigation";
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
  requestMicrophonePermission,
  type AudioDeviceOption,
} from "../../client/call-media";

interface CallContextValue {
  state: CallState;
  homeHref: "/home" | "/coach";
  notice: string | null;
  busy: boolean;
  audioBlocked: boolean;
  localMicrophoneActive: boolean;
  remoteSpeaking: boolean;
  startCall(recipientId: string, recipientName: string): Promise<void>;
  answer(): Promise<void>;
  decline(): Promise<void>;
  cancel(): Promise<void>;
  end(): Promise<void>;
  toggleMute(): Promise<void>;
  hearCall(): Promise<void>;
  loadCall(callId: string): Promise<void>;
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
  const stateRef = useRef(state);
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
        await media.connect(found.call.id, joined.connection, true);
      }
    }
  }, [applyCall, commands, media, realtime, userId]);

  useEffect(() => {
    let active = true;
    const recover = () => {
      const currentCallId = stateRef.current.current.callId;
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
      void realtime.findCall(event.callId, userId).then((found) => {
        if (!active || !found) return;
        applyCall(found.call, found.counterpartName);
        if (
          found.call.status === "connecting" &&
          found.call.initiatedBy === userId
        ) {
          void commands.join(found.call.id).then(async (joined) => {
            if (joined.ok && joined.connection) {
              await media.connect(
                found.call.id,
                joined.connection,
                true
              );
              return;
            }
            setNotice(
              joined.ok
                ? "This call could not connect yet."
                : joined.notice
            );
          }).catch(() => {
            setNotice("The call didn’t connect. Messages still work.");
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
  }, [applyCall, commands, media, realtime, router, userId]);

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
    startCall: async (recipientId, recipientName) => run(async () => {
      if (selectHasLiveCall(stateRef.current)) {
        setNotice("Finish the current call before starting another one.");
        return;
      }
      dispatch({
        type: "permissionRequested",
        counterpartId: recipientId,
        counterpartName: recipientName,
      });
      const permission = await requestMicrophonePermission();
      if (permission !== "granted") {
        dispatch({
          type: "permissionDenied",
          reason: permission === "denied"
            ? "permissionDenied"
            : "deviceUnavailable",
        });
        setNotice(
          permission === "denied"
            ? "Allow microphone access in your browser, then try the call again."
            : "We couldn’t find a microphone. Check your device and try again."
        );
        return;
      }
      const result = await commands.initiate({
        recipientId,
        kind: "audio",
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
        expiresAt: result.call.expiresAt,
      });
      router.push(`/calls/${result.call.id}`);
    }),
    answer: async () => run(async () => {
      const callId = stateRef.current.current.callId;
      if (!callId) return;
      const permission = await requestMicrophonePermission();
      if (permission !== "granted") {
        setNotice("Allow microphone access in your browser, then answer again.");
        return;
      }
      const result = await commands.accept(callId);
      if (!result.ok || !result.connection) {
        setNotice(result.ok ? "This call could not connect yet." : result.notice);
        return;
      }
      dispatch({ type: "callAccepted", callId });
      await media.connect(callId, result.connection, true);
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
    hearCall: async () => media.startAudio(),
    loadCall,
    clear: () => {
      setNotice(null);
      setAudioBlocked(false);
      setSpeaking({
        localMicrophoneActive: false,
        remoteSpeaking: false,
      });
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
  }), [audioBlocked, busy, commands, homeHref, loadCall, media, notice, router, run, speaking, state]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const value = useContext(CallContext);
  if (!value) throw new Error("useCall must be used inside CallProvider");
  return value;
}
