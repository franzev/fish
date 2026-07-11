"use client";

import {
  clearChatStore,
  ensureChatStoreOwner,
} from "@/features/chat/model/store";
import { subscribeToChatSessionChanges } from "../client/chat-session-listener";
import { useEffect } from "react";

interface ChatIdentityGuardProps {
  userId: string;
}

/* CR-01 cache-partition guard, mounted once in the authenticated layout
   alongside AppShell. Two independent triggers purge the module-singleton
   chat store so no account can read another account's local draft/pending
   rows:
   1. Prop-change effect: re-partitions to the server-verified userId on
      every authenticated render, covering a non-button account switch on
      the same tab (a soft nav keeps the JS module alive across accounts).
   2. Auth-state listener: purges on SIGNED_OUT and on any event whose
      session belongs to a DIFFERENT user, covering cross-tab sign-out and
      session expiry-then-login. A same-user event (e.g. TOKEN_REFRESHED)
      is a no-op.
   This is a purge trigger only -- it never reads role/permission data and
   makes no authorization decision; RLS/Edge Functions remain the sole
   authority (D-05, D-08). Renders nothing. */
export function ChatIdentityGuard({ userId }: ChatIdentityGuardProps) {
  useEffect(() => {
    ensureChatStoreOwner(userId);
  }, [userId]);

  useEffect(() => {
    return subscribeToChatSessionChanges((event, session) => {
      if (event === "SIGNED_OUT") {
        clearChatStore();
        return;
      }

      if (session?.user.id) {
        ensureChatStoreOwner(session.user.id);
      }
    });

  }, []);

  return null;
}
