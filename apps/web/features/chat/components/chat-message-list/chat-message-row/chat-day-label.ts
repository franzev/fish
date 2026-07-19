export function isSameLocalCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatChatDayLabel(
  timestamp: string,
  now = new Date()
): string {
  const messageDate = new Date(timestamp);

  if (isSameLocalCalendarDay(messageDate, now)) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalCalendarDay(messageDate, yesterday)) {
    return "Yesterday";
  }

  return messageDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
