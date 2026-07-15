"use client";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { getBrowserServices, getFriendCommandService } from "@/lib/services/runtime/browser";
import type {
  FriendCandidate,
  FriendCommandService,
  FriendRepository,
} from "@/lib/services";
import { cn } from "@/lib/utils";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { IconBan, IconDots, IconX } from "@tabler/icons-react";
import { useRef, useState, type ReactNode } from "react";
import { Avatar } from "../avatar";

export interface CommunityMemberProfile {
  id: string;
  displayName: string;
  username?: string | null;
  role?: "client" | "coach";
  avatarUrl?: string | null;
}

interface MemberProfilePopoverProps {
  member: CommunityMemberProfile;
  currentUserId: string;
  currentUserRole: "client" | "coach";
  friendActionsEnabled?: boolean;
  trigger: "avatar" | "name" | "custom";
  children?: ReactNode;
  className?: string;
  repository?: FriendRepository;
  commands?: FriendCommandService;
}

const friendStatusNotice =
  "Friend status isn’t available yet. Give it a moment and try again.";

/**
 * A calm identity preview for community message authors. The popup only
 * exposes the already-validated client-to-client Friends workflow; coaches,
 * self previews, and a disabled feature gate stay informational.
 */
export function MemberProfilePopover({
  member,
  currentUserId,
  currentUserRole,
  friendActionsEnabled = false,
  trigger,
  children,
  className,
  repository: repositoryOverride,
  commands: commandsOverride,
}: MemberProfilePopoverProps) {
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<FriendCandidate | null>(null);
  const [loadingRelationship, setLoadingRelationship] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const asyncSequence = useRef(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const confirmBlockRef = useRef<HTMLButtonElement>(null);
  const canCheckFriendStatus =
    friendActionsEnabled &&
    currentUserRole === "client" &&
    member.role !== "coach" &&
    member.id !== currentUserId;
  const relationshipConfirmsClient =
    member.role === "client" ||
    Boolean(candidate?.profile) ||
    confirmingBlock ||
    blocked;
  const showRelationshipSection =
    canCheckFriendStatus &&
    (loadingRelationship || relationshipConfirmsClient || Boolean(notice));

  async function loadRelationship(sequence: number) {
    if (!canCheckFriendStatus || !member.username) {
      setLoadingRelationship(false);
      return;
    }

    setLoadingRelationship(true);
    const repository =
      repositoryOverride ?? getBrowserServices().database.friends;
    let result;
    try {
      result = await repository.searchCandidate(member.username);
    } catch {
      if (sequence !== asyncSequence.current) return;
      setLoadingRelationship(false);
      setCandidate(null);
      setNotice(friendStatusNotice);
      return;
    }
    if (sequence !== asyncSequence.current) return;

    setLoadingRelationship(false);
    if (!result.ok) {
      setCandidate(null);
      setNotice(friendStatusNotice);
      return;
    }
    setCandidate(result.data);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    const sequence = ++asyncSequence.current;

    if (!nextOpen) {
      setLoadingRelationship(false);
      setSendingRequest(false);
      setBlocking(false);
      setConfirmingBlock(false);
      setNotice(null);
      return;
    }

    setCandidate(null);
    setNotice(null);
    setBlocked(false);
    setConfirmingBlock(false);
    setClientRequestId(crypto.randomUUID());
    void loadRelationship(sequence);
  }

  async function sendFriendRequest() {
    if (
      !candidate?.profile ||
      candidate.status !== "none" ||
      !clientRequestId ||
      sendingRequest
    ) {
      return;
    }

    const sequence = ++asyncSequence.current;
    setSendingRequest(true);
    setNotice(null);
    let result;
    try {
      result = await getFriendCommandService(commandsOverride).sendRequest({
        targetId: member.id,
        clientRequestId,
      });
    } catch {
      if (sequence !== asyncSequence.current) return;
      setSendingRequest(false);
      setNotice("That friend request didn’t send yet. Try again.");
      return;
    }
    if (sequence !== asyncSequence.current) return;

    setSendingRequest(false);
    if (!result.ok) {
      if (result.code === "request_pending") {
        setCandidate({ ...candidate, status: "outgoingPending" });
        return;
      }
      if (result.code === "already_friends") {
        setCandidate({ ...candidate, status: "friends" });
        return;
      }
      if (result.code === "incoming_request_exists") {
        const refreshSequence = ++asyncSequence.current;
        await loadRelationship(refreshSequence);
        return;
      }
      setNotice(result.notice);
      return;
    }

    if (result.data.status === "accepted") {
      setCandidate({ ...candidate, status: "friends" });
      return;
    }
    if (result.data.status === "pending") {
      setCandidate({ ...candidate, status: "outgoingPending" });
      return;
    }
    setCandidate({ ...candidate, status: "unavailable" });
  }

  function startBlockConfirmation() {
    setNotice(null);
    setConfirmingBlock(true);
    requestAnimationFrame(() => confirmBlockRef.current?.focus());
  }

  function cancelBlockConfirmation() {
    setConfirmingBlock(false);
    setNotice(null);
    requestAnimationFrame(() => moreRef.current?.focus());
  }

  async function blockMember() {
    if (blocking) return;

    const sequence = ++asyncSequence.current;
    setBlocking(true);
    setNotice(null);
    let result;
    try {
      result = await getFriendCommandService(commandsOverride).blockUser(
        member.id
      );
    } catch {
      if (sequence !== asyncSequence.current) return;
      setBlocking(false);
      setNotice("That member wasn’t blocked yet. Try again.");
      return;
    }
    if (sequence !== asyncSequence.current) return;

    setBlocking(false);
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }

    setBlocked(true);
    setConfirmingBlock(false);
    setCandidate(null);
    requestAnimationFrame(() => closeRef.current?.focus());
  }

  function renderRelationshipContent() {
    if (loadingRelationship) {
      return (
        <p role="status" className="flex min-h-control items-center text-ui-sm text-muted">
          Checking friend status…
        </p>
      );
    }

    if (candidate?.status === "none" && candidate.profile) {
      return (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          loading={sendingRequest}
          onClick={() => void sendFriendRequest()}
        >
          Add friend
        </Button>
      );
    }

    if (candidate?.status === "outgoingPending") {
      return (
        <p role="status" className="flex min-h-control items-center text-ui-sm text-body">
          Request sent
        </p>
      );
    }

    if (candidate?.status === "incomingPending") {
      return (
        <Button
          href={
            candidate.requestId
              ? `/friends/requests/${candidate.requestId}`
              : "/friends/requests"
          }
          onClick={() => handleOpenChange(false)}
          variant="secondary"
          fullWidth
        >
          Review request
        </Button>
      );
    }

    if (candidate?.status === "friends") {
      return (
        <p role="status" className="flex min-h-control items-center text-ui-sm text-body">
          Friends
        </p>
      );
    }

    // Keep the relationship slot stable without exposing why a person is
    // unavailable (unknown, declined, blocked, or feature-gated at the DB).
    return <div aria-hidden="true" className="min-h-control" />;
  }

  const triggerLabel = `View ${member.displayName} profile`;

  return (
    <Popover.Root
      open={open}
      onOpenChange={handleOpenChange}
      modal="trap-focus"
    >
      <Popover.Trigger
        aria-label={triggerLabel}
        className={cn(
          trigger === "avatar"
            ? "-m-nudge inline-flex min-h-control min-w-control items-center justify-center rounded-pill p-nudge"
            : trigger === "name"
              ? "-my-sm inline-flex min-h-control min-w-control items-center rounded-control text-left text-ui-sm font-medium leading-none text-body hover:text-foreground"
              : "inline-flex min-h-control min-w-control",
          className
        )}
      >
        {children ?? (trigger === "avatar" ? (
          <Avatar
            profileId={member.id}
            src={member.avatarUrl ?? undefined}
            name={member.displayName}
            size="sm"
            alt=""
          />
        ) : (
          member.displayName
        ))}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Backdrop className="fixed inset-0 z-40 hidden bg-scrim max-sm:block" />
        <Popover.Positioner
          side="right"
          align="start"
          className="member-profile-positioner z-50"
        >
          <Popover.Popup
            aria-busy={
              loadingRelationship || sendingRequest || blocking || undefined
            }
            className="max-sm:m-0 data-[side=bottom]:mt-xs data-[side=left]:mr-xs data-[side=right]:ml-xs data-[side=top]:mb-xs w-member-profile max-w-member-profile-mobile rounded-card border border-divider bg-surface p-md text-body outline-none"
            initialFocus={closeRef}
          >
            <div className="flex items-start gap-sm">
              <Avatar
                profileId={member.id}
                src={member.avatarUrl ?? undefined}
                name={member.displayName}
                size="lg"
                alt=""
              />
              <div className="min-w-0 flex-1 pt-2xs">
                <Popover.Title className="truncate font-sans text-copy font-semibold text-foreground">
                  {member.displayName}
                </Popover.Title>
                <Popover.Description className="flex flex-col text-ui-sm text-muted">
                  {member.username && <span>@{member.username}</span>}
                  <span>
                    {member.role === "coach" ? "Coach" : "Community member"}
                  </span>
                </Popover.Description>
              </div>
              <div className="flex shrink-0 items-center gap-2xs">
                {canCheckFriendStatus &&
                  relationshipConfirmsClient &&
                  !blocked &&
                  !confirmingBlock && (
                  <Menu.Root modal={false}>
                    <Menu.Trigger
                      ref={moreRef}
                      aria-label={`More actions for ${member.displayName}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", controlSize: "square" }),
                        "hover:bg-surface-2"
                      )}
                    >
                      <IconDots size={20} stroke={1.75} aria-hidden="true" />
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Positioner
                        side="bottom"
                        align="end"
                        className="z-50"
                      >
                        <Menu.Popup className="mt-2xs min-w-menu rounded-card border border-divider bg-surface p-3xs">
                          <Menu.Item
                            onClick={startBlockConfirmation}
                            className="flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-notice data-[highlighted]:bg-surface-2"
                          >
                            <IconBan size={20} stroke={1.75} aria-hidden="true" />
                            Block member
                          </Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Root>
                )}
                <Popover.Close
                  ref={closeRef}
                  aria-label={`Close ${member.displayName} profile`}
                  className={cn(
                    buttonVariants({ variant: "ghost", controlSize: "square" }),
                    "hover:bg-surface-2"
                  )}
                >
                  <IconX size={20} stroke={1.75} aria-hidden="true" />
                </Popover.Close>
              </div>
            </div>

            {showRelationshipSection && (
              <div
                aria-live="polite"
                className="mt-md border-t border-divider pt-md"
              >
                {blocked ? (
                  <Alert tone="notice" role="status">
                    {member.displayName} is blocked. You’ll still see each
                    other’s messages in community channels.
                  </Alert>
                ) : confirmingBlock ? (
                  <div className="flex flex-col gap-md">
                    {notice && <Alert tone="notice">{notice}</Alert>}
                    <p className="text-ui text-body">
                      Block {member.displayName}? They won’t be able to find you
                      or send friend requests. Any friendship will be removed.
                      You’ll still see each other’s community messages, and
                      they won’t be told.
                    </p>
                    <div className="flex flex-col gap-xs">
                      <Button
                        ref={confirmBlockRef}
                        type="button"
                        variant="secondary"
                        fullWidth
                        loading={blocking}
                        onClick={() => void blockMember()}
                      >
                        Block
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        fullWidth
                        disabled={blocking}
                        onClick={cancelBlockConfirmation}
                      >
                        Go back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-xs">
                    {notice && <Alert tone="notice">{notice}</Alert>}
                    {renderRelationshipContent()}
                  </div>
                )}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
