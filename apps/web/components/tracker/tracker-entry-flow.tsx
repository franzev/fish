"use client";

import type { FieldAnswer } from "@fish/core";
import type { ClientTrackerField, TrackerProgress } from "@/lib/services";
import { FieldRenderer } from "@/components/fields";
import {
  AutosaveStatus,
  type AutosaveStatusKind,
} from "@/components/onboarding/autosave-status";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MilestoneProgress } from "./milestone-progress";

interface TrackerEntryFlowProps {
  trackerName: string;
  coachDisplayName?: string | null;
  fields: ClientTrackerField[];
  answers: Record<string, FieldAnswer>;
  progress: TrackerProgress;
  autosaveStatus?: AutosaveStatusKind;
  notice?: string | null;
  saving?: boolean;
  onAnswerChange: (fieldId: string, answer: FieldAnswer) => void | Promise<void>;
  onSaveEntry: () => void | Promise<void>;
}

export function TrackerEntryFlow({
  trackerName,
  coachDisplayName,
  fields,
  answers,
  progress,
  autosaveStatus = "idle",
  notice,
  saving = false,
  onAnswerChange,
  onSaveEntry,
}: TrackerEntryFlowProps) {
  if (fields.length === 0) {
    return (
      <Card className="space-y-2">
        <h2 className="font-display text-heading text-foreground">
          Nothing to log yet
        </h2>
        <p className="text-copy text-body">
          Your coach will add the next check-in when it is ready.
        </p>
      </Card>
    );
  }

  return (
    <section className="mx-auto w-full max-w-content space-y-6">
      <MilestoneProgress
        progress={progress}
        coachDisplayName={coachDisplayName}
      />

      <div className="space-y-2">
        <h2 className="font-display text-heading text-foreground">
          {trackerName}
        </h2>
        <p className="text-copy text-body">
          Save what fits today. Your coach sees saved entries, not drafts.
        </p>
      </div>

      {notice && <Alert tone="notice">{notice}</Alert>}

      <div className="space-y-3">
        {fields.map((field) => (
          <Card key={field.id} className="space-y-3">
            <FieldRenderer
              config={field.config}
              value={answers[field.id] ?? null}
              disabled={saving}
              showSubmit={false}
              onChange={(answer) => void onAnswerChange(field.id, answer)}
            />
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          fullWidth
          loading={saving}
          disabled={saving}
          onClick={() => void onSaveEntry()}
        >
          Save entry
        </Button>
        <AutosaveStatus status={autosaveStatus} />
      </div>
    </section>
  );
}
