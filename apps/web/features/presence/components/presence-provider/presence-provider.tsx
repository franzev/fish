"use client";

import type {
  PresenceCommandService,
  PresenceDurationSeconds,
  PresencePreference,
  PresencePreferenceSetting,
  PresenceRepository,
  PresenceRealtimeService,
  PresenceSnapshot,
} from "@/lib/services";
import {
  createInitialPresenceState,
  reducePresenceState,
  selectPresenceIsChanging,
  selectPresenceSnapshots,
  type PresenceState,
} from "@fish/core/presence";
import {
  getBrowserServices,
  getPresenceCommandService,
  getPresenceRealtimeService,
} from "@/lib/services/runtime/browser";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useState,
} from "react";
import {
  getOwnPresenceDisplayStatus,
  getPresencePresentation,
  presenceLabels,
} from "../../model/presentation";

interface PresenceContextValue {
  userId: string;
  snapshots: ReadonlyMap<string, PresenceSnapshot>;
  preference: PresencePreference;
  expiresAt: string | null;
  preferenceRevision: number;
  now: Date;
  timeFormatPref: TimeFormatPref;
  changing: boolean;
  notice: string | null;
  setPreference: (
    preference: PresencePreference,
    durationSeconds?: PresenceDurationSeconds | null
  ) => Promise<boolean>;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

interface PresenceProviderProps {
  userId: string;
  timeFormatPref?: TimeFormatPref;
  children: React.ReactNode;
  commands?: PresenceCommandService;
  repository?: PresenceRepository;
  realtime?: PresenceRealtimeService;
}

export function PresenceProvider({
  userId,
  timeFormatPref = null,
  children,
  commands: commandsOverride,
  repository: repositoryOverride,
  realtime: realtimeOverride,
}: PresenceProviderProps) {
  const [presenceState, dispatch] = useReducer(
    reducePresenceState,
    undefined,
    createInitialPresenceState
  );
  const presenceStateRef = useRef<PresenceState>(presenceState);
  useEffect(() => {
    presenceStateRef.current = presenceState;
  }, [presenceState]);
  const [now, setNow] = useState(() => new Date());
  const visibleSubjectIdsRef = useRef(new Set([userId]));
  const requestSequenceRef = useRef(0);
  const sessionRef = useRef<ReturnType<PresenceRealtimeService["startSession"]> | null>(
    null
  );
  const [commandNotice, setCommandNotice] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const realtime = useMemo(
    () => getPresenceRealtimeService(realtimeOverride),
    [realtimeOverride]
  );
  const snapshots = useMemo(
    () => selectPresenceSnapshots(presenceState),
    [presenceState]
  );
  const preferenceSetting = presenceState.preferenceSetting;
  const changing = selectPresenceIsChanging(presenceState);

  const mergeSnapshot = useCallback((snapshot: PresenceSnapshot) => {
    if (
      snapshot.userId !== userId &&
      !visibleSubjectIdsRef.current.has(snapshot.userId)
    ) return;
    dispatch({ type: "snapshotReceived", snapshot });
    setNow(new Date());
  }, [userId]);

  const refresh = useCallback(async () => {
    const repository = repositoryOverride ?? getBrowserServices().database.presence;
    const [visible, ownPreference] = await Promise.all([
      repository.listVisible(),
      repository.getOwnPreference(),
    ]);
    if (visible.ok) {
      visibleSubjectIdsRef.current = new Set([
        userId,
        ...visible.data.map((snapshot) => snapshot.userId),
      ]);
      dispatch({ type: "snapshotsHydrated", snapshots: visible.data });
    }
    if (ownPreference.ok) {
      dispatch({ type: "preferenceHydrated", setting: ownPreference.data });
    }
    setNow(new Date());
  }, [repositoryOverride, userId]);

  useEffect(() => {
    const session = realtime.startSession(mergeSnapshot, () => {
      setSessionNotice("Status is reconnecting. We’ll keep trying.");
    });
    sessionRef.current = session;
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(initialRefresh);
      sessionRef.current = null;
      session.stop();
    };
  }, [mergeSnapshot, realtime, refresh]);

  const subscriptionKey = useMemo(
    () => Array.from(new Set([userId, ...snapshots.keys()])).sort().join("|"),
    [snapshots, userId]
  );

  useEffect(() => {
    const subjectIds = subscriptionKey ? subscriptionKey.split("|") : [userId];
    const unsubscribe = realtime.subscribe(
      userId,
      subjectIds,
      mergeSnapshot,
      (nextSetting, revision) => {
        dispatch({
          type: "preferenceChangeReceived",
          setting: nextSetting,
          revision,
        });
      },
      () => {
        setSessionNotice(null);
        sessionRef.current?.markActive();
        void refresh();
      },
      (status) => {
        if (status === "disconnected") {
          setSessionNotice("Status is reconnecting. We’ll keep trying.");
        }
      }
    );
    return unsubscribe;
  }, [mergeSnapshot, realtime, refresh, subscriptionKey, userId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const setPreference = useCallback(async (
    next: PresencePreference,
    durationSeconds: PresenceDurationSeconds | null = null
  ) => {
    if (presenceStateRef.current.pendingPreference) return false;
    const optimisticSetting: PresencePreferenceSetting = {
      preference: next,
      expiresAt: durationSeconds === null
        ? null
        : new Date(Date.now() + durationSeconds * 1_000).toISOString(),
    };
    const requestId = `presence-preference-${++requestSequenceRef.current}`;
    dispatch({
      type: "preferenceSetRequested",
      requestId,
      setting: optimisticSetting,
    });
    setCommandNotice(null);
    let result;
    try {
      result = await getPresenceCommandService(commandsOverride).setMode(
        next,
        durationSeconds
      );
    } catch {
      result = {
        ok: false as const,
        code: "presence_unavailable",
        notice: "Your status could not change. Try again.",
      };
    }
    if (!result.ok) {
      dispatch({ type: "preferenceSetFailed", requestId });
      setCommandNotice(result.notice);
      return false;
    }
    dispatch({
      type: "preferenceSetSucceeded",
      requestId,
      setting: result.setting,
      snapshot: result.snapshot,
    });
    return true;
  }, [commandsOverride]);

  useEffect(() => {
    if (!preferenceSetting.expiresAt) return;
    const expiresAt = preferenceSetting.expiresAt;
    const remaining = Math.max(
      0,
      Date.parse(expiresAt) - Date.now()
    );
    const timeout = window.setTimeout(() => {
      if (presenceStateRef.current.preferenceSetting.expiresAt !== expiresAt) return;
      dispatch({
        type: "preferenceExpired",
        now: new Date().toISOString(),
      });
      void setPreference("automatic");
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [preferenceSetting.expiresAt, setPreference]);

  const value = useMemo<PresenceContextValue>(() => ({
    userId,
    snapshots,
    preference: preferenceSetting.preference,
    expiresAt: preferenceSetting.expiresAt,
    preferenceRevision: presenceState.preferenceRevision,
    now,
    timeFormatPref,
    changing,
    notice: commandNotice ?? sessionNotice,
    setPreference,
  }), [
    userId,
    snapshots,
    preferenceSetting,
    presenceState.preferenceRevision,
    now,
    timeFormatPref,
    changing,
    commandNotice,
    sessionNotice,
    setPreference,
  ]);

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

function usePresenceContext() {
  return useContext(PresenceContext);
}

export function usePresence(userId?: string) {
  const context = usePresenceContext();
  if (!context) {
    return {
      snapshot: null,
      ...getPresencePresentation(null, new Date()),
    };
  }
  const snapshot = userId ? context.snapshots.get(userId) ?? null : null;
  return {
    snapshot,
    ...getPresencePresentation(snapshot, context.now, context.timeFormatPref),
  };
}

export function useOwnPresence() {
  const context = usePresenceContext();
  const base = usePresence(context?.userId);
  if (!context) {
    return {
      ...base,
      displayStatus: "offline" as const,
      displayLabel: presenceLabels.offline,
      preference: "automatic" as const,
      expiresAt: null,
      changing: false,
      notice: null,
      setPreference: (async () => false) as PresenceContextValue["setPreference"],
    };
  }
  const displayStatus = getOwnPresenceDisplayStatus(
    base.status,
    context.preference,
    context.changing
  );
  return {
    ...base,
    displayStatus,
    displayLabel: presenceLabels[displayStatus],
    preference: context.preference,
    expiresAt: context.expiresAt,
    changing: context.changing,
    notice: context.notice,
    setPreference: context.setPreference,
  };
}
