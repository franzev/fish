"use client";

import { Button } from "@/components/ui/button";
import { clearChatStore } from "@/app/(authenticated)/chat/store/chat-store";
import { signOut } from "@/lib/auth/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface LogoutButtonProps {
  className?: string;
}

/* The ONE client island in the shell's top bar (mirrors kit/page.tsx's
   KitThemeToggle precedent). No confirmation dialog — the product is
   calm/frictionless and sessions are cheap to re-establish (UI-SPEC).
   D-09: the bar is all-secondary — this is a quiet ghost action, not the
   screen's primary. The screen carries ZERO primary actions (D-18: "at
   most one primary action" includes zero). */
export function LogoutButton({ className }: LogoutButtonProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await signOut();
    // Logout is a soft `router.push` (no full reload), so the module-global
    // chat store survives. Clear it here so a different account signing in
    // on the same tab never inherits this account's draft, pending/failed
    // local messages, or hydration keys (closes CR-01).
    clearChatStore();
    router.push("/login");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      fullWidth={false}
      loading={loading}
      onClick={handleLogout}
      className={className}
    >
      Log out
    </Button>
  );
}
