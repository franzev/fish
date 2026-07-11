import { cn } from "@/lib/utils";

interface BubbleRadiusOptions {
  mine: boolean;
  groupedWithPrevious?: boolean;
  groupedWithNext?: boolean;
}

export function getBubbleRadiusClasses({
  mine,
  groupedWithPrevious = false,
  groupedWithNext = false,
}: BubbleRadiusOptions) {
  if (mine) {
    return cn(
      "rounded-tl-chat rounded-bl-chat",
      groupedWithPrevious ? "rounded-tr-chat-inner" : "rounded-tr-chat",
      groupedWithNext || (!groupedWithPrevious && !groupedWithNext)
        ? "rounded-br-chat-inner"
        : "rounded-br-chat"
    );
  }

  return cn(
    "rounded-tr-chat rounded-br-chat",
    groupedWithPrevious ? "rounded-tl-chat-inner" : "rounded-tl-chat",
    groupedWithNext || (!groupedWithPrevious && !groupedWithNext)
      ? "rounded-bl-chat-inner"
      : "rounded-bl-chat"
  );
}
