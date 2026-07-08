"use client";

import { useState } from "react";
import { Reactions } from "@/components/chat";
import type { Reaction } from "@/components/chat/types";

/* Kit-only client island: the Reactions primitive needs an onToggle to show
   its add-reaction pill + picker, and the kit page is a server component. */
export function ReactionsDemo() {
  const [reactions, setReactions] = useState<Reaction[]>([
    { emoji: "👍", count: 3, byMe: true },
    { emoji: "🎉", count: 1, byMe: false },
  ]);

  const toggle = (emoji: string) => {
    setReactions((current) => {
      const existing = current.find((reaction) => reaction.emoji === emoji);
      if (!existing) {
        return [...current, { emoji, count: 1, byMe: true }];
      }
      return current
        .map((reaction) =>
          reaction.emoji === emoji
            ? {
                ...reaction,
                byMe: !reaction.byMe,
                count: reaction.count + (reaction.byMe ? -1 : 1),
              }
            : reaction
        )
        .filter((reaction) => reaction.count > 0);
    });
  };

  return <Reactions reactions={reactions} onToggle={toggle} />;
}
