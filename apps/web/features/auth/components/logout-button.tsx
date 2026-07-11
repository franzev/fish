"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLogout } from "../client/use-logout";

interface LogoutButtonProps {
  className?: string;
}

/* The Profile settings "Sign out" row (the header now uses UserMenu instead).
   No confirmation dialog — the product is calm/frictionless and sessions are
   cheap to re-establish (UI-SPEC). D-09: this is a quiet ghost action, never
   a primary. Routes through the shared useLogout hook so clearChatStore()
   (CR-01) always runs before the redirect, same as UserMenu's Log out item.
   A failed sign-out (CR-01) never clears state or navigates -- it surfaces
   the hook's calm notice-tone guidance below the button instead. */
export function LogoutButton({ className }: LogoutButtonProps = {}) {
  const { logout, loading, notice } = useLogout();

  return (
    <div className="flex flex-col items-end gap-xs">
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
      {notice && <Alert tone="notice">{notice}</Alert>}
    </div>
  );
}
