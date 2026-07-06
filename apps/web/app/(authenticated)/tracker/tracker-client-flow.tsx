"use client";

import type { FieldAnswer } from "@fish/core";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AutosaveStatusKind } from "@/components/onboarding/autosave-status";
import { TrackerEntryFlow } from "@/components/tracker";
import type { ClientTrackerData } from "@/lib/services";
import type {
  SaveTrackerDraftActionState,
  SaveTrackerEntryActionState,
} from "./actions";

interface TrackerClientFlowProps {
  tracker: ClientTrackerData;
  saveDraftAction: (input: unknown) => Promise<SaveTrackerDraftActionState>;
  saveEntryAction: (input: unknown) => Promise<SaveTrackerEntryActionState>;
}

export function TrackerClientFlow({
  tracker,
  saveDraftAction,
  saveEntryAction,
}: TrackerClientFlowProps) {
  const router = useRouter();
  const initialAnswers = useMemo(
    () => ({ ...tracker.savedAnswers, ...tracker.draftAnswers }),
    [tracker.savedAnswers, tracker.draftAnswers]
  );
  const [answers, setAnswers] = useState<Record<string, FieldAnswer>>(initialAnswers);
  const [autosaveStatus, setAutosaveStatus] =
    useState<AutosaveStatusKind>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAnswerChange(fieldId: string, answer: FieldAnswer) {
    setAnswers((current) => ({ ...current, [fieldId]: answer }));
    setNotice(null);
    setAutosaveStatus("saving");

    const result = await saveDraftAction({ fieldId, answer });
    if (result.status !== "saved") {
      setAutosaveStatus("error");
      setNotice(result.notice ?? "That draft did not save yet. Keep this open and try again.");
      return;
    }

    setAutosaveStatus("saved");
  }

  async function handleSaveEntry() {
    const answersToSave = tracker.fields
      .map((field) => ({ fieldId: field.id, answer: answers[field.id] }))
      .filter(
        (item): item is { fieldId: string; answer: FieldAnswer } =>
          item.answer != null
      );

    if (answersToSave.length === 0) {
      setNotice("Add one answer before saving.");
      setAutosaveStatus("idle");
      return;
    }

    setSaving(true);
    setNotice(null);
    setAutosaveStatus("saving");

    for (const item of answersToSave) {
      const result = await saveEntryAction(item);
      if (result.status !== "saved") {
        setSaving(false);
        setAutosaveStatus("error");
        setNotice(result.notice ?? "That did not save yet. Keep this open and try again.");
        return;
      }
    }

    setSaving(false);
    setAutosaveStatus("saved");
    router.refresh();
  }

  return (
    <TrackerEntryFlow
      trackerName={tracker.trackerName}
      coachDisplayName={tracker.coachDisplayName}
      fields={tracker.fields}
      answers={answers}
      progress={tracker.progress}
      autosaveStatus={autosaveStatus}
      notice={notice}
      saving={saving}
      onAnswerChange={handleAnswerChange}
      onSaveEntry={handleSaveEntry}
    />
  );
}
