"use client";

import { Alert } from "@/components/ui/alert";
import {
  ActionMenuItem,
  ActionMenuPopup,
  ActionMenuRoot,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type {
  FriendCommandService,
  FriendRepository,
} from "@/lib/services";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { IconBan, IconDots, IconX } from "@tabler/icons-react";
import { useRef, useState, type ReactNode } from "react";
import { useFriendRelationship } from "@/features/chat/hooks/use-friend-relationship";
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
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const {
    canCheckFriendStatus,
    candidate,
    loadingRelationship,
    sendingRequest,
    blocking,
    blocked,
    notice,
    open: openRelationship,
    close: closeRelationship,
    sendFriendRequest,
    blockMember,
    setNotice,
  } = useFriendRelationship({
    member,
    currentUserId,
    currentUserRole,
    friendActionsEnabled,
    repository: repositoryOverride,
    commands: commandsOverride,
  });
  const closeRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const confirmBlockRef = useRef<HTMLButtonElement>(null);
  const relationshipConfirmsClient =
    member.role === "client" ||
    Boolean(candidate?.profile) ||
    confirmingBlock ||
    blocked;
  const showRelationshipSection =
    canCheckFriendStatus &&
    (loadingRelationship || relationshipConfirmsClient || Boolean(notice));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      closeRelationship();
      setConfirmingBlock(false);
      return;
    }

    setConfirmingBlock(false);
    openRelationship();
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

  async function handleBlockMember() {
    if (await blockMember()) {
      setConfirmingBlock(false);
      requestAnimationFrame(() => closeRef.current?.focus());
    }
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
                  <ActionMenuRoot modal={false}>
                    <ActionMenuTrigger
                      render={
                        <IconButton
                          ref={moreRef}
                          label={`More actions for ${member.displayName}`}
                          appearance="ghost"
                          icon={<IconDots size={20} stroke={1.75} aria-hidden="true" />}
                        />
                      }
                    />
                    <ActionMenuPopup className="mt-2xs">
                          <ActionMenuItem
                            onClick={startBlockConfirmation}
                            className="text-notice"
                          >
                            <IconBan size={20} stroke={1.75} aria-hidden="true" />
                            Block member
                          </ActionMenuItem>
                    </ActionMenuPopup>
                  </ActionMenuRoot>
                )}
                <Popover.Close
                  render={
                    <IconButton
                      ref={closeRef}
                      label={`Close ${member.displayName} profile`}
                      appearance="ghost"
                      icon={<IconX size={20} stroke={1.75} aria-hidden="true" />}
                    />
                  }
                />
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
                        onClick={() => void handleBlockMember()}
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
