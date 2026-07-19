import { useCallback, useEffect, useRef } from "react";

export interface LatestRequestToken {
  conversationId: string;
  sequence: number;
}

export function useLatestRequest(conversationId: string) {
  const sequenceRef = useRef(0);
  const conversationRef = useRef(conversationId);

  useEffect(() => {
    conversationRef.current = conversationId;
    sequenceRef.current += 1;
  }, [conversationId]);

  const begin = useCallback((): LatestRequestToken => {
    const sequence = ++sequenceRef.current;
    return { conversationId: conversationRef.current, sequence };
  }, []);

  const isLatest = useCallback((token: LatestRequestToken): boolean => (
    token.conversationId === conversationRef.current &&
    token.sequence === sequenceRef.current
  ), []);

  const invalidate = useCallback(() => {
    sequenceRef.current += 1;
  }, []);

  return { begin, isLatest, invalidate };
}
