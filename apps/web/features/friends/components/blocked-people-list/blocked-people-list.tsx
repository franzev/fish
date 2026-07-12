"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getFriendCommandService } from "@/lib/services/runtime/browser";
import type { FriendCommandService, FriendProfile } from "@/lib/services";
import { useMemo, useState } from "react";

interface BlockedPeopleListProps {
  initialBlockedPeople: FriendProfile[];
  commands?: FriendCommandService;
}

export function BlockedPeopleList({
  initialBlockedPeople,
  commands: commandsOverride,
}: BlockedPeopleListProps) {
  const commands = useMemo(
    () => getFriendCommandService(commandsOverride),
    [commandsOverride]
  );
  const [blockedPeople, setBlockedPeople] = useState(initialBlockedPeople);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function unblock(person: FriendProfile) {
    if (workingId) return;
    setWorkingId(person.id);
    setNotice(null);
    const result = await commands.unblockUser(person.id);
    setWorkingId(null);
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }
    setBlockedPeople((current) =>
      current.filter((candidate) => candidate.id !== person.id)
    );
    setNotice(`${person.displayName} is no longer blocked.`);
  }

  return (
    <div className="flex flex-col gap-md">
      {notice && (
        <div aria-live="polite">
          <Alert tone="notice">{notice}</Alert>
        </div>
      )}

      {blockedPeople.length === 0 ? (
        <p className="text-copy text-body">No one is blocked right now.</p>
      ) : (
        <ul className="flex flex-col gap-xs">
          {blockedPeople.map((person) => (
            <li
              key={person.id}
              className="flex min-h-control items-center justify-between gap-sm rounded-control border border-border bg-surface px-md"
            >
              <span className="flex min-w-0 flex-col py-xs">
                <span className="truncate text-copy text-foreground">
                  {person.displayName}
                </span>
                <span className="truncate text-ui-sm text-muted">
                  @{person.username}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                loading={workingId === person.id}
                disabled={workingId !== null}
                onClick={() => void unblock(person)}
              >
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
