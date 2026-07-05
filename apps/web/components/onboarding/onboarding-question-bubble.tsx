"use client";

import { Bubble } from "@/components/chat";

interface OnboardingQuestionBubbleProps {
  prompt: string;
  positionLabel: string;
}

export function OnboardingQuestionBubble({
  prompt,
  positionLabel,
}: OnboardingQuestionBubbleProps) {
  return (
    <Bubble mine={false} className="space-y-2">
      <p>{prompt}</p>
      <p className="text-ui-sm text-muted">{positionLabel}</p>
    </Bubble>
  );
}
