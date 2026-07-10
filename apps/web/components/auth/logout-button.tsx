"use client";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/auth/use-logout";

interface LogoutButtonProps {
  className?: string;
}

/* The Profile settings "Sign out" row (the header now uses UserMenu instead).
   No confirmation dialog — the product is calm/frictionless and sessions are
   cheap to re-establish (UI-SPEC). D-09: this is a quiet ghost action, never
   a primary. Routes through the shared useLogout hook so clearChatStore()
   (CR-01) always runs before the redirect, same as UserMenu's Log out item. */
export function LogoutButton({ className }: LogoutButtonProps = {}) {
  const { logout, loading } = useLogout();

  return (
    <Button
      type="button"
      variant="ghost"
      fullWidth={false}
      loading={loading}
      onClick={logout}
      className={className}
    >
      Log out
    </Button>
  );
}
