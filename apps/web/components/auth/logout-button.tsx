"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/* The ONE client island on the otherwise server-rendered /home (mirrors
   kit/page.tsx's KitThemeToggle precedent). No confirmation dialog — the
   product is calm/frictionless and sessions are cheap to re-establish
   (UI-SPEC). This is the one primary action on /home. */
export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <Button
      type="button"
      variant="primary"
      loading={loading}
      onClick={handleLogout}
    >
      Log out
    </Button>
  );
}
