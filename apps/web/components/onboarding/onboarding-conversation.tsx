"use client";

import type {
  FieldAnswer,
  FieldConfig,
  OnboardingAttemptStatus,
  OnboardingQuestion,
} from "@fish/core";
import { useMemo, useState } from "react";
import { Bubble, EmptyState, Skeleton } from "@/components/chat";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FieldRenderer } from "@/components/fields";
import {
  AutosaveStatus,
  type AutosaveStatusKind,
} from "./autosave-status";
import { OnboardingQuestionBubble } from "./onboarding-question-bubble";

interface OnboardingConversationProps {
  questions: OnboardingQuestion[];
  savedAnswers: Record<string, FieldAnswer>;
  attemptStatus: OnboardingAttemptStatus;
  currentQuestionId?: string | null;
  autosaveStatus?: AutosaveStatusKind;
  loading?: boolean;
  onSaveAnswer: (questionId: string, answer: FieldAnswer) => void | Promise<void>;
  onFinalize: () => void | Promise<void>;
}

export function OnboardingConversation({
  questions,
  savedAnswers,
  attemptStatus,
  currentQuestionId,
  autosaveStatus = "idle",
  loading = false,
  onSaveAnswer,
  onFinalize,
}: OnboardingConversationProps) {
  const [draftAnswers, setDraftAnswers] =
    useState<Record<string, FieldAnswer>>({});

  const totalQuestions = questions.length;
  const allSaved =
    totalQuestions > 0 &&
    questions.every((question) => Boolean(savedAnswers[question.id]));
  const isSubmitted = attemptStatus === "submitted";

  const currentIndex = useMemo(() => {
    const requestedIndex = currentQuestionId
      ? questions.findIndex((question) => question.id === currentQuestionId)
      : -1;
    if (requestedIndex >= 0) return requestedIndex;

    const firstOpenIndex = questions.findIndex(
      (question) => !savedAnswers[question.id]
    );
    return firstOpenIndex >= 0 ? firstOpenIndex : 0;
  }, [currentQuestionId, questions, savedAnswers]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-content space-y-4">
        <p className="text-ui-sm text-muted">Loading your next question...</p>
        <Skeleton />
      </section>
    );
  }

  if (totalQuestions === 0) {
    return (
      <EmptyState
        title="Nothing to answer yet"
        description="Your coach will add the next step when it is ready."
      />
    );
  }

  if (allSaved || isSubmitted) {
    return (
      <section className="mx-auto w-full max-w-content space-y-6">
        <Progress value={100} label={`Question ${totalQuestions} of ${totalQuestions}`} />
        <AnswerTranscript questions={questions} answers={savedAnswers} />
        <div className="space-y-3 rounded-card border border-border bg-surface p-4">
          <h2 className="font-display text-heading text-foreground">
            Your answers are ready for your coach
          </h2>
          <p className="text-copy text-body">They will guide what comes next.</p>
          {!isSubmitted && (
            <Button type="button" fullWidth onClick={() => void onFinalize()}>
              Share with coach
            </Button>
          )}
        </div>
      </section>
    );
  }

  const currentQuestion = questions[currentIndex] ?? questions[0];
  const currentLabel = `Question ${currentIndex + 1} of ${totalQuestions}`;
  const completedCount = questions.filter((question) =>
    Boolean(savedAnswers[question.id])
  ).length;
  const progressValue =
    totalQuestions === 0
      ? 0
      : Math.round((Math.max(completedCount, currentIndex) / totalQuestions) * 100);
  const currentAnswer =
    draftAnswers[currentQuestion.id] ?? savedAnswers[currentQuestion.id] ?? null;

  function handleChange(answer: FieldAnswer) {
    setDraftAnswers((current) => ({
      ...current,
      [currentQuestion.id]: answer,
    }));

    if (savesOnChange(currentQuestion.config)) {
      void onSaveAnswer(currentQuestion.id, answer);
    }
  }

  function handleSubmit(answer: FieldAnswer) {
    setDraftAnswers((current) => ({
      ...current,
      [currentQuestion.id]: answer,
    }));
    void onSaveAnswer(currentQuestion.id, answer);
  }

  return (
    <section className="mx-auto w-full max-w-content space-y-5">
      <Progress value={progressValue} label={currentLabel} />
      <div
        role="log"
        aria-label="Onboarding conversation"
        className="flex flex-col gap-3"
      >
        <AnswerTranscript
          questions={questions.slice(0, currentIndex)}
          answers={savedAnswers}
        />
        <div className="flex justify-start">
          <OnboardingQuestionBubble
            prompt={currentQuestion.prompt}
            positionLabel={currentLabel}
          />
        </div>
      </div>
      <div className="space-y-2">
        <FieldRenderer
          config={currentQuestion.config}
          value={currentAnswer}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
        <AutosaveStatus status={autosaveStatus} />
      </div>
    </section>
  );
}

function AnswerTranscript({
  questions,
  answers,
}: {
  questions: OnboardingQuestion[];
  answers: Record<string, FieldAnswer>;
}) {
  return (
    <>
      {questions.map((question) => {
        const answer = answers[question.id];
        if (!answer) return null;

        return (
          <div key={question.id} className="flex justify-end">
            <Bubble mine>{formatAnswer(question.config, answer)}</Bubble>
          </div>
        );
      })}
    </>
  );
}

function savesOnChange(config: FieldConfig): boolean {
  return (
    config.type === "single_select" ||
    config.type === "scale" ||
    config.type === "boolean"
  );
}

function formatAnswer(config: FieldConfig, answer: FieldAnswer): string {
  switch (answer.type) {
    case "single_select":
      return findOptionLabel(config, answer.optionId);
    case "multi_select":
      return answer.optionIds.map((id) => findOptionLabel(config, id)).join(", ");
    case "scale":
      return findOptionLabel(config, answer.value);
    case "short_text":
    case "long_text":
      return answer.value;
    case "boolean": {
      if (config.type !== "boolean") return answer.value ? "Yes" : "Not right now";
      return answer.value ? config.options[0].label : config.options[1].label;
    }
  }
}

function findOptionLabel(config: FieldConfig, optionId: string): string {
  if (!("options" in config)) return optionId;
  return (
    config.options.find((option) => option.id === optionId)?.label ?? optionId
  );
}
