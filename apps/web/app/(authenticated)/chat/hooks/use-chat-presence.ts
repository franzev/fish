import type { ClientChatData, ClientChatPresenceSession } from "@/lib/services";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import { useEffect, useMemo, useState } from "react";
import {
  derivePresenceSnapshot,
  formatPresenceStatus,
} from "../presence";
import {
  startPresenceSession,
  subscribeToParticipantPresence,
} from "../realtime";

interface UseChatPresenceOptions {
  chat: ClientChatData;
  timeFormatPref: TimeFormatPref;
}

interface ParticipantPresenceState {
  participantId: string;
  sourceKey: string;
  sessions: ClientChatPresenceSession[];
}

function createPresenceSessionsKey(sessions: ClientChatPresenceSession[]): string {
  return JSON.stringify(
    sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      activeAt: session.activeAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      endedAt: session.endedAt ?? null,
    }))
  );
}

export function useChatPresence({ chat, timeFormatPref }: UseChatPresenceOptions) {
  const providedPresenceSessions = useMemo(
    () => chat.participantPresence?.sessions ?? [],
    [chat.participantPresence?.sessions]
  );
  const providedPresenceKey = useMemo(
    () => createPresenceSessionsKey(providedPresenceSessions),
    [providedPresenceSessions]
  );
  const [participantPresenceState, setParticipantPresenceState] =
    useState<ParticipantPresenceState>(() => ({
      participantId: chat.participant.id,
      sourceKey: providedPresenceKey,
      sessions: providedPresenceSessions,
    }));
  const [now, setNow] = useState(() => new Date());
  const participantPresenceSessions =
    participantPresenceState.participantId === chat.participant.id &&
    participantPresenceState.sourceKey === providedPresenceKey
      ? participantPresenceState.sessions
      : providedPresenceSessions;

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const presence = startPresenceSession(chat.currentUserId);

    return () => {
      presence.stop();
    };
  }, [chat.currentUserId]);

  useEffect(() => {
    return subscribeToParticipantPresence(chat.participant.id, (session, eventType) => {
      setParticipantPresenceState((current) => {
        const currentSessions =
          current.participantId === chat.participant.id &&
          current.sourceKey === providedPresenceKey
            ? current.sessions
            : providedPresenceSessions;

        if (eventType === "DELETE") {
          return {
            participantId: chat.participant.id,
            sourceKey: providedPresenceKey,
            sessions: currentSessions.filter((item) => item.id !== session.id),
          };
        }

        const existingIndex = currentSessions.findIndex((item) => item.id === session.id);
        if (existingIndex === -1) {
          return {
            participantId: chat.participant.id,
            sourceKey: providedPresenceKey,
            sessions: [...currentSessions, session],
          };
        }

        const next = [...currentSessions];
        next[existingIndex] = session;
        return {
          participantId: chat.participant.id,
          sourceKey: providedPresenceKey,
          sessions: next,
        };
      });
      setNow(new Date());
    });
  }, [chat.participant.id, providedPresenceKey, providedPresenceSessions]);

  const participantPresence = derivePresenceSnapshot(
    participantPresenceSessions,
    now
  );
  const presenceStatus = formatPresenceStatus(
    {
      ...participantPresence,
      lastSeenAt:
        participantPresence.lastSeenAt ?? chat.participantPresence?.lastSeenAt ?? null,
    },
    now,
    timeFormatPref
  );

  return {
    presenceStatus,
  };
}
