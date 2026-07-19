import { useEffect } from "react";

const baseTitle = "FISH";
const countLimit = 9;

export function formatBrowserTabTitle(unreadConversationCount: number): string {
  if (unreadConversationCount === 0) return baseTitle;
  const count = unreadConversationCount > countLimit
    ? `${countLimit}+`
    : unreadConversationCount;
  return `(${count}) ${baseTitle}`;
}

export function useBrowserTabTitle(unreadConversationCount: number): void {
  useEffect(() => {
    const initialTitle = document.title || baseTitle;
    return () => {
      document.title = initialTitle;
    };
  }, []);

  useEffect(() => {
    document.title = formatBrowserTabTitle(unreadConversationCount);
  }, [unreadConversationCount]);
}
