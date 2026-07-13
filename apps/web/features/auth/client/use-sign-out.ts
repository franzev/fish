"use client";

import "client-only";

import { clearChatStore } from "@/features/chat/model/store";
import { signOut as performSignOut } from "./browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

/* Single-sourced sign-out handler shared by SignOutButton (profile "Sign out"
   row) and UserMenu (header). No confirmation dialog — the product is
   calm/frictionless and sessions are cheap to re-establish (UI-SPEC).
   clearChatStore() must run after signOut() and before the soft
   router.push, or a different account signing in on the same tab could
   inherit this account's draft/pending messages (CR-01). A FAILED signOut
   (result.ok === false) must never clear or navigate either -- half
   completing the transition would silently drop this account's draft with
   no way back, so failure preserves the current account's state and
   surfaces a calm retry notice instead (CR-01). */
export function useSignOut() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function signOut() {
    setNotice(null);
    setLoading(true);
    const result = await performSignOut();

    if (!result.ok) {
      setLoading(false);
      setNotice(
        "We couldn't sign you out just now. Check your connection and try again."
      );
      return;
    }

    clearChatStore();
    router.push("/sign-in");
  }

  return { signOut, loading, notice };
}
