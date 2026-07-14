"use client";

import type {
  PresenceCommandService,
  PresencePreference,
  PresenceRepository,
  PresenceRealtimeService,
  PresenceSnapshot,
} from "@/lib/services";
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
  useState,
} from "react";
import {
  getPresencePresentation,
  presenceLabels,
  type PresenceDisplayStatus,
} from "../../model/presentation";

interface PresenceContextValue {
  userId: string;
  snapshots: ReadonlyMap<string, PresenceSnapshot>;
  preference: PresencePreference;
  preferenceRevision: number;
  now: Date;
  timeFormatPref: TimeFormatPref;
  changing: boolean;
  notice: string | null;
  setPreference: (preference: PresencePreference) => Promise<boolean>;
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
  const [snapshots, setSnapshots] = useState<Map<string, PresenceSnapshot>>(
    () => new Map()
  );
  const [preference, setPreferenceState] =
    useState<PresencePreference>("automatic");
  const [preferenceRevision, setPreferenceRevision] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [changing, setChanging] = useState(false);
  const changingRef = useRef(false);
  const visibleSubjectIdsRef = useRef(new Set([userId]));
  const sessionRef = useRef<ReturnType<PresenceRealtimeService["startSession"]> | null>(
    null
  );
  const [commandNotice, setCommandNotice] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const realtime = useMemo(
    () => getPresenceRealtimeService(realtimeOverride),
    [realtimeOverride]
  );

  const mergeSnapshot = useCallback((snapshot: PresenceSnapshot) => {
    if (
      snapshot.userId !== userId &&
      !visibleSubjectIdsRef.current.has(snapshot.userId)
    ) return;
    setSnapshots((current) => {
      const previous = current.get(snapshot.userId);
      if (previous && previous.revision >= snapshot.revision) return current;
      const next = new Map(current);
      next.set(snapshot.userId, snapshot);
      return next;
    });
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
      setSnapshots((current) => {
        const next = new Map<string, PresenceSnapshot>();
        visible.data.forEach((snapshot) => {
          const previous = current.get(snapshot.userId);
          if (!previous || previous.revision < snapshot.revision) {
            next.set(snapshot.userId, snapshot);
          } else {
            next.set(snapshot.userId, previous);
          }
        });
        return next;
      });
    }
    if (ownPreference.ok) {
      setPreferenceRevision((current) => {
        if (current === 0) setPreferenceState(ownPreference.data);
        return current;
      });
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
      (nextPreference, revision) => {
        setPreferenceRevision((current) => {
          if (revision < current) return current;
          setPreferenceState(nextPreference);
          return revision;
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

  const setPreference = useCallback(async (next: PresencePreference) => {
    if (changingRef.current || next === preference) return next === preference;
    changingRef.current = true;
    setChanging(true);
    setCommandNotice(null);
    let result;
    try {
      result = await getPresenceCommandService(commandsOverride).setMode(next);
    } catch {
      result = {
        ok: false as const,
        code: "presence_unavailable",
        notice: "Your status could not change. Try again.",
      };
    }
    changingRef.current = false;
    setChanging(false);
    if (!result.ok) {
      setCommandNotice(result.notice);
      return false;
    }
    setPreferenceState(next);
    setPreferenceRevision(result.snapshot.revision);
    mergeSnapshot(result.snapshot);
    return true;
  }, [commandsOverride, mergeSnapshot, preference]);

  const value = useMemo<PresenceContextValue>(() => ({
    userId,
    snapshots,
    preference,
    preferenceRevision,
    now,
    timeFormatPref,
    changing,
    notice: commandNotice ?? sessionNotice,
    setPreference,
  }), [
    userId,
    snapshots,
    preference,
    preferenceRevision,
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
      changing: false,
      notice: null,
      setPreference: async () => false,
    };
  }
  const displayStatus: PresenceDisplayStatus =
    context.preference === "invisible" ? "invisible" : base.status;
  return {
    ...base,
    displayStatus,
    displayLabel: presenceLabels[displayStatus],
    preference: context.preference,
    changing: context.changing,
    notice: context.notice,
    setPreference: context.setPreference,
  };
}
