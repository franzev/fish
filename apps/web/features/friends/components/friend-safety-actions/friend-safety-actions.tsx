"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getFriendCommandService } from "@/lib/services/runtime/browser";
import type { FriendCommandService, FriendProfile } from "@/lib/services";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface FriendSafetyActionsProps {
  friend: FriendProfile;
  commands?: FriendCommandService;
  successHref?: string;
}

type SafetyAction = "remove" | "block";

const confirmCopy: Record<SafetyAction, (name: string) => string> = {
  remove: (name) =>
    `Unfriend ${name}? You can add each other again later.`,
  block: (name) =>
    `Block ${name}? They won’t be able to find you or send requests, and they won’t be told.`,
};

export function FriendSafetyActions({
  friend,
  commands: commandsOverride,
  successHref,
}: FriendSafetyActionsProps) {
  const router = useRouter();
  const commands = useMemo(
    () => getFriendCommandService(commandsOverride),
    [commandsOverride]
  );
  const [confirming, setConfirming] = useState<SafetyAction | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: SafetyAction) {
    if (working) return;
    setWorking(true);
    setNotice(null);
    const result = action === "remove"
      ? await commands.removeFriend(friend.id)
      : await commands.blockUser(friend.id);
    if (!result.ok) {
      setWorking(false);
      setNotice(result.notice);
      return;
    }
    router.push(
      successHref ?? (action === "block" ? "/friends/blocked" : "/friends")
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-md" aria-live="polite">
        {notice && <Alert tone="notice">{notice}</Alert>}
        <p className="text-ui text-body">
          {confirmCopy[confirming](friend.displayName)}
        </p>
        <Button
          type="button"
          variant="secondary"
          fullWidth
          loading={working}
          className={confirming === "block" ? "text-error hover:text-error" : undefined}
          onClick={() => void run(confirming)}
        >
          {confirming === "remove" ? "Unfriend" : "Block"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          disabled={working}
          onClick={() => setConfirming(null)}
        >
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-xs" aria-live="polite">
      {notice && <Alert tone="notice">{notice}</Alert>}
      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={() => setConfirming("remove")}
      >
        Unfriend
      </Button>
      <Button
        type="button"
        variant="ghost"
        fullWidth
        className="text-error hover:text-error"
        onClick={() => setConfirming("block")}
      >
        Block @{friend.username}
      </Button>
    </div>
  );
}
