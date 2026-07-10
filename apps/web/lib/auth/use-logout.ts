"use client";

import { clearChatStore } from "@/app/(authenticated)/chat/store/chat-store";
import { signOut } from "@/lib/auth/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

/* Single-sourced logout handler shared by LogoutButton (profile "Sign out"
   row) and UserMenu (header). No confirmation dialog — the product is
   calm/frictionless and sessions are cheap to re-establish (UI-SPEC).
   clearChatStore() must run after signOut() and before the soft
   router.push, or a different account signing in on the same tab could
   inherit this account's draft/pending messages (CR-01). */
export function useLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await signOut();
    clearChatStore();
    router.push("/login");
  }

  return { logout, loading };
}
