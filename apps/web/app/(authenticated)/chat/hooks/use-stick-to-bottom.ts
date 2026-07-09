"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LocalMessage } from "./use-chat-messages";

/** How close to the bottom (px) still counts as "reading the latest". */
const nearBottomThreshold = 100;

interface UseStickToBottomOptions {
  messages: LocalMessage[];
  currentUserId: string;
}

/** Conditional stick-to-bottom for the chat log: jump to the newest message
 *  on mount, always follow the user's own sends, stick when they are already
 *  near the bottom — but never yank them down while they are reading history.
 *  Instead, `showNewMessages` signals a calm "New messages" pill. */
export function useStickToBottom({
  messages,
  currentUserId,
}: UseStickToBottomOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const previousLastIdRef = useRef(
    messages[messages.length - 1]?.id ?? messages[messages.length - 1]?.clientRequestId
  );
  const [showNewMessages, setShowNewMessages] = useState(false);

  const scrollToBottom = useCallback((behavior?: ScrollBehavior) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: reducedMotion ? "auto" : behavior ?? "smooth",
    });
    setShowNewMessages(false);
  }, []);

  // First paint opens on the newest messages — no visible scroll animation.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  // Track whether the reader is near the bottom; arriving back at the bottom
  // dismisses the pill without needing a click.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      const distance =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const nearBottom = distance <= nearBottomThreshold;
      isNearBottomRef.current = nearBottom;
      if (nearBottom) {
        setShowNewMessages(false);
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  // Content can grow without a new message (typing indicator, late-loading
  // rows). Re-pin instantly while stuck to the bottom so nothing animates.
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = viewport?.firstElementChild;
    if (!viewport || !content) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // New message: follow own sends and near-bottom readers; otherwise leave
  // the reading position alone and raise the pill instead. Keyed off the
  // newest message's IDENTITY (not the array length) so a prepended older
  // page — same newest message, larger array — is inert to this hook; a
  // length comparison would misread a prepend as "a new message arrived"
  // and yank a reader mid-scroll-restore down to the bottom (CLOAD-04).
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id ?? lastMessage?.clientRequestId;
    const previousLastId = previousLastIdRef.current;
    previousLastIdRef.current = lastId;

    if (!lastId || lastId === previousLastId) {
      return;
    }

    if (lastMessage?.senderId === currentUserId || isNearBottomRef.current) {
      scrollToBottom();
      return;
    }

    setShowNewMessages(true);
  }, [messages, currentUserId, scrollToBottom]);

  return { viewportRef, showNewMessages, scrollToBottom };
}
