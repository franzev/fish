"use client";

import type { FieldAnswer, OnboardingAttemptStatus } from "@fish/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OnboardingConversation } from "@/components/onboarding/onboarding-conversation";
import type { AutosaveStatusKind } from "@/components/onboarding/autosave-status";
import type { ClientOnboardingData } from "@/lib/services";
import type {
  FinalizeOnboardingAttemptActionState,
  SaveOnboardingAnswerActionState,
} from "./actions";

interface OnboardingClientFlowProps {
  onboarding: ClientOnboardingData;
  saveAction: (input: unknown) => Promise<SaveOnboardingAnswerActionState>;
  finalizeAction: () => Promise<FinalizeOnboardingAttemptActionState>;
}

export function OnboardingClientFlow({
  onboarding,
  saveAction,
  finalizeAction,
}: OnboardingClientFlowProps) {
  const router = useRouter();
  const [savedAnswers, setSavedAnswers] = useState(onboarding.savedAnswers);
  const [currentQuestionId, setCurrentQuestionId] = useState(
    onboarding.currentQuestionId
  );
  const [attemptStatus, setAttemptStatus] =
    useState<OnboardingAttemptStatus>(
      onboarding.status === "submitted" ? "submitted" : "in_progress"
    );
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatusKind>(
    onboarding.status === "in_progress" &&
      Object.keys(onboarding.savedAnswers).length > 0
      ? "resume"
      : "idle"
  );

  async function handleSaveAnswer(questionId: string, answer: FieldAnswer) {
    setAutosaveStatus("saving");
    const result = await saveAction({ questionId, answer });

    if (result.status !== "saved" || !result.result) {
      setAutosaveStatus("error");
      return;
    }

    setSavedAnswers((current) => ({ ...current, [questionId]: answer }));
    setCurrentQuestionId(result.result.currentQuestionId);
    setAttemptStatus(result.result.status);
    setAutosaveStatus("saved");
    router.refresh();
  }

  async function handleFinalize() {
    setAutosaveStatus("saving");
    const result = await finalizeAction();

    if (result.status !== "complete") {
      setAutosaveStatus("error");
      return;
    }

    setAttemptStatus("submitted");
    setCurrentQuestionId(null);
    setAutosaveStatus("saved");
    router.refresh();
  }

  return (
    <OnboardingConversation
      questions={onboarding.questions}
      savedAnswers={savedAnswers}
      attemptStatus={attemptStatus}
      currentQuestionId={currentQuestionId}
      autosaveStatus={autosaveStatus}
      onSaveAnswer={handleSaveAnswer}
      onFinalize={handleFinalize}
    />
  );
}
