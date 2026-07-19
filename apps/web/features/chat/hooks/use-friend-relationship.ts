import { getBrowserServices, getFriendCommandService } from "@/lib/services/runtime/browser";
import type {
  FriendCandidate,
  FriendCommandService,
  FriendRepository,
} from "@/lib/services";
import { useCallback, useState } from "react";
import { useLatestRequest } from "./use-latest-request";
import { nextCandidateStatus } from "../model/friend-status";

export interface FriendRelationshipMember {
  id: string;
  username?: string | null;
  role?: "client" | "coach";
}

interface UseFriendRelationshipOptions {
  member: FriendRelationshipMember;
  currentUserId: string;
  currentUserRole: "client" | "coach";
  friendActionsEnabled: boolean;
  repository?: FriendRepository;
  commands?: FriendCommandService;
}

const unavailableNotice =
  "Friend status isn’t available yet. Give it a moment and try again.";

export function useFriendRelationship({
  member,
  currentUserId,
  currentUserRole,
  friendActionsEnabled,
  repository: repositoryOverride,
  commands: commandsOverride,
}: UseFriendRelationshipOptions) {
  const [candidate, setCandidate] = useState<FriendCandidate | null>(null);
  const [loadingRelationship, setLoadingRelationship] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const { begin, isLatest, invalidate } = useLatestRequest(member.id);
  const canCheckFriendStatus =
    friendActionsEnabled &&
    currentUserRole === "client" &&
    member.role !== "coach" &&
    member.id !== currentUserId;

  const loadRelationship = useCallback(async () => {
    const sequence = begin();
    if (!canCheckFriendStatus || !member.username) {
      setLoadingRelationship(false);
      return;
    }
    setLoadingRelationship(true);
    const repository = repositoryOverride ?? getBrowserServices().database.friends;
    try {
      const result = await repository.searchCandidate(member.username);
      if (!isLatest(sequence)) return;
      setLoadingRelationship(false);
      if (!result.ok) {
        setCandidate(null);
        setNotice(unavailableNotice);
        return;
      }
      setCandidate(result.data);
    } catch {
      if (!isLatest(sequence)) return;
      setLoadingRelationship(false);
      setCandidate(null);
      setNotice(unavailableNotice);
    }
  }, [begin, canCheckFriendStatus, isLatest, member.username, repositoryOverride]);

  const open = useCallback(() => {
    invalidate();
    setCandidate(null);
    setNotice(null);
    setBlocked(false);
    setClientRequestId(globalThis.crypto?.randomUUID?.() ?? `friend-${Date.now()}`);
    void loadRelationship();
  }, [invalidate, loadRelationship]);

  const close = useCallback(() => {
    invalidate();
    setLoadingRelationship(false);
    setSendingRequest(false);
    setBlocking(false);
    setNotice(null);
  }, [invalidate]);

  const sendFriendRequest = useCallback(async () => {
    if (!candidate?.profile || candidate.status !== "none" || !clientRequestId || sendingRequest) return;
    const sequence = begin();
    setSendingRequest(true);
    setNotice(null);
    let result: Awaited<ReturnType<FriendCommandService["sendRequest"]>>;
    try {
      result = await getFriendCommandService(commandsOverride).sendRequest({
        targetId: member.id,
        clientRequestId,
      });
    } catch {
      if (!isLatest(sequence)) return;
      setSendingRequest(false);
      setNotice("That friend request didn’t send yet. Try again.");
      return;
    }
    if (!isLatest(sequence)) return;
    setSendingRequest(false);
    const transition = nextCandidateStatus(candidate, result);
    if (transition.type === "candidate") setCandidate(transition.candidate);
    if (transition.type === "notice") setNotice(transition.notice);
    if (transition.type === "refresh") await loadRelationship();
  }, [begin, candidate, clientRequestId, commandsOverride, isLatest, loadRelationship, member.id, sendingRequest]);

  const blockMember = useCallback(async () => {
    if (blocking) return false;
    const sequence = begin();
    setBlocking(true);
    setNotice(null);
    try {
      const result = await getFriendCommandService(commandsOverride).blockUser(member.id);
      if (!isLatest(sequence)) return false;
      setBlocking(false);
      if (!result.ok) {
        setNotice(result.notice);
        return false;
      }
      setBlocked(true);
      setCandidate(null);
      return true;
    } catch {
      if (!isLatest(sequence)) return false;
      setBlocking(false);
      setNotice("That member wasn’t blocked yet. Try again.");
      return false;
    }
  }, [begin, blocking, commandsOverride, isLatest, member.id]);

  return {
    canCheckFriendStatus,
    candidate,
    loadingRelationship,
    sendingRequest,
    blocking,
    blocked,
    notice,
    open,
    close,
    sendFriendRequest,
    blockMember,
    setNotice,
  };
}
