import type { ClientChatData, ClientChatPresenceSession } from "@/lib/services";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import { useEffect, useState } from "react";
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

export function useChatPresence({ chat, timeFormatPref }: UseChatPresenceOptions) {
  const [participantPresenceSessions, setParticipantPresenceSessions] = useState<
    ClientChatPresenceSession[]
  >(() => chat.participantPresence?.sessions ?? []);
  const [now, setNow] = useState(() => new Date());

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
      setParticipantPresenceSessions((current) => {
        if (eventType === "DELETE") {
          return current.filter((item) => item.id !== session.id);
        }

        const existingIndex = current.findIndex((item) => item.id === session.id);
        if (existingIndex === -1) {
          return [...current, session];
        }

        const next = [...current];
        next[existingIndex] = session;
        return next;
      });
      setNow(new Date());
    });
  }, [chat.participant.id]);

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
