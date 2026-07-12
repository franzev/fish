"use client";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getBrowserServices,
  getFriendCommandService,
} from "@/lib/services/runtime/browser";
import type {
  FriendCandidate,
  FriendCommandService,
  FriendRepository,
} from "@/lib/services";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

interface AddFriendFormProps {
  repository?: FriendRepository;
  commands?: FriendCommandService;
}

const unavailableCopy =
  "That person isn’t available. Check the username and try again.";

export function AddFriendForm({
  repository: repositoryOverride,
  commands: commandsOverride,
}: AddFriendFormProps) {
  const repository = useMemo(
    () => repositoryOverride ?? getBrowserServices().database.friends,
    [repositoryOverride]
  );
  const commands = useMemo(
    () => getFriendCommandService(commandsOverride),
    [commandsOverride]
  );

  const [username, setUsername] = useState("");
  const [inputNotice, setInputNotice] = useState<string | undefined>();
  const [searching, setSearching] = useState(false);
  const [candidate, setCandidate] = useState<FriendCandidate | null>(null);
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function resetToSearch() {
    setCandidate(null);
    setClientRequestId(null);
    setSent(false);
    setNotice(null);
    setInputNotice(undefined);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length === 0) {
      setInputNotice("Add a username to search.");
      return;
    }
    setInputNotice(undefined);
    setNotice(null);
    setSearching(true);
    const result = await repository.searchCandidate(trimmed);
    setSearching(false);
    if (!result.ok) {
      setNotice("The search didn’t go through. Give it a moment and try again.");
      return;
    }
    setCandidate(result.data);
    // One id per found person: a retried tap resends the same request
    // instead of creating a new one.
    setClientRequestId(crypto.randomUUID());
    setSent(false);
  }

  async function sendRequest() {
    if (!candidate?.profile || !clientRequestId || sending) return;
    const profile = candidate.profile;
    setSending(true);
    setNotice(null);
    const result = await commands.sendRequest({
      targetId: profile.id,
      clientRequestId,
    });
    setSending(false);
    if (!result.ok) {
      if (result.code === "request_pending" || result.code === "already_friends") {
        setSent(result.code === "request_pending");
        setCandidate({
          ...candidate,
          status: result.code === "request_pending" ? "outgoingPending" : "friends",
        });
        return;
      }
      if (result.code === "incoming_request_exists") {
        // They sent their own request between our search and this tap; a
        // fresh lookup recovers the request id so review is one step away.
        const lookup = await repository.searchCandidate(profile.username);
        if (lookup.ok && lookup.data.status === "incomingPending") {
          setCandidate(lookup.data);
          return;
        }
      }
      setNotice(result.notice);
      return;
    }
    // The server may replay an earlier request for this key; trust its
    // status rather than assuming the send landed as pending.
    if (result.data.status === "accepted") {
      setCandidate({ ...candidate, status: "friends" });
      return;
    }
    if (result.data.status === "pending") {
      setSent(true);
      return;
    }
    setCandidate({ ...candidate, status: "unavailable" });
  }

  if (!candidate) {
    return (
      <form onSubmit={(event) => void search(event)} className="flex flex-col gap-md">
        {notice && <Alert tone="notice">{notice}</Alert>}
        <Input
          label="Username"
          name="username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          hint="Usernames look like @sam_lee. Ask your friend for theirs."
          notice={inputNotice}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <Button type="submit" fullWidth loading={searching}>
          Search
        </Button>
      </form>
    );
  }

  const profile = candidate.profile;
  const showRequestSent =
    sent || candidate.status === "outgoingPending";

  return (
    <div className="flex flex-col gap-md" aria-live="polite">
      {notice && <Alert tone="notice">{notice}</Alert>}

      {!profile || candidate.status === "unavailable" ? (
        <Alert tone="notice">{unavailableCopy}</Alert>
      ) : (
        <Card className="flex flex-col gap-md">
          <div className="flex flex-col">
            <span className="text-copy font-semibold text-foreground">
              {profile.displayName}
            </span>
            <span className="text-ui-sm text-muted">@{profile.username}</span>
          </div>

          {showRequestSent ? (
            <p className="text-ui text-body">
              Request sent. They&apos;ll see it when they&apos;re ready.
            </p>
          ) : candidate.status === "friends" ? (
            <p className="text-ui text-body">You&apos;re already friends.</p>
          ) : candidate.status === "incomingPending" ? (
            <>
              <p className="text-ui text-body">
                They already sent you a request.
              </p>
              <Link
                href={
                  candidate.requestId
                    ? `/friends/requests/${candidate.requestId}`
                    : "/friends/requests"
                }
                className={cn(buttonVariants({ variant: "primary" }))}
              >
                Review request
              </Link>
            </>
          ) : (
            <Button
              type="button"
              fullWidth
              loading={sending}
              onClick={() => void sendRequest()}
            >
              Add friend
            </Button>
          )}
        </Card>
      )}

      <Button type="button" variant="ghost" onClick={resetToSearch}>
        Search again
      </Button>
    </div>
  );
}
