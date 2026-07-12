"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getFriendCommandService } from "@/lib/services/runtime/browser";
import type {
  FriendCommandService,
  IncomingFriendRequest,
} from "@/lib/services";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/features/chat";

interface FriendRequestReviewProps {
  request: IncomingFriendRequest;
  commands?: FriendCommandService;
}

export function FriendRequestReview({
  request,
  commands: commandsOverride,
}: FriendRequestReviewProps) {
  const router = useRouter();
  const commands = useMemo(
    () => getFriendCommandService(commandsOverride),
    [commandsOverride]
  );
  const [responding, setResponding] = useState<"accept" | "decline" | null>(
    null
  );
  const [notice, setNotice] = useState<string | null>(null);

  async function respond(response: "accept" | "decline") {
    if (responding) return;
    setResponding(response);
    setNotice(null);
    const result = await commands.respondRequest({
      requestId: request.requestId,
      response,
    });
    if (!result.ok) {
      setResponding(null);
      setNotice(result.notice);
      return;
    }
    router.push(response === "accept" ? "/friends" : "/friends/requests");
  }

  return (
    <div className="flex flex-col gap-md">
      {notice && (
        <div aria-live="polite">
          <Alert tone="notice">{notice}</Alert>
        </div>
      )}
      <Card className="flex flex-col gap-md">
        <div className="flex items-center gap-sm">
          <Avatar
            profileId={request.sender.id}
            src={request.sender.avatarUrl ?? undefined}
            name={request.sender.displayName}
            size="lg"
            alt=""
          />
          <div className="flex min-w-0 flex-col">
          <span className="text-copy font-semibold text-foreground">
            {request.sender.displayName}
          </span>
          <span className="text-ui-sm text-muted">
            @{request.sender.username}
          </span>
          </div>
        </div>
        <p className="text-ui text-body">
          Wants to be friends. Accept when you&apos;re ready — there&apos;s no
          rush.
        </p>
        <Button
          type="button"
          fullWidth
          loading={responding === "accept"}
          disabled={responding !== null}
          onClick={() => void respond("accept")}
        >
          Accept request
        </Button>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          loading={responding === "decline"}
          disabled={responding !== null}
          onClick={() => void respond("decline")}
        >
          Decline
        </Button>
      </Card>
      <p className="text-center text-ui-sm text-muted">
        <Link href="/friends/requests" className="text-body underline">
          Back to requests
        </Link>
      </p>
    </div>
  );
}
