import { useEffect } from "react";

interface KeyedSubscriptionOptions {
  key: string;
  subscribe(schedule: () => void): () => void;
  onInvalidate(): void;
  delayMs?: number;
}

export function useKeyedSubscription({
  key,
  subscribe,
  onInvalidate,
  delayMs = 150,
}: KeyedSubscriptionOptions): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onInvalidate();
      }, delayMs);
    };
    const unsubscribe = subscribe(schedule);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [delayMs, key, onInvalidate, subscribe]);
}
