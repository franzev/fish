import type { TrackerProgress, TrackerProgressStep } from "@/lib/services";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface MilestoneProgressProps {
  progress: TrackerProgress;
  coachDisplayName?: string | null;
}

export function MilestoneProgress({
  progress,
  coachDisplayName,
}: MilestoneProgressProps) {
  const currentStep =
    progress.steps.find((step) => step.state === "now") ??
    progress.steps.find((step) => step.state === "up_next") ??
    progress.steps.at(-1);
  if (progress.steps.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="tracker-milestones-heading">
      <div className="space-y-1">
        <h2
          id="tracker-milestones-heading"
          className="font-display text-heading text-foreground"
        >
          Your path
        </h2>
        <p className="text-ui text-muted">Small steps, saved as you go.</p>
        <p className="text-ui-sm text-muted">
          {coachDisplayName
            ? `${coachDisplayName} adds each step as you're ready.`
            : "Your coach adds each step as you're ready."}
        </p>
      </div>

      <Progress
        value={currentStep?.currentStepProgress ?? 0}
        label={currentStep?.label ?? "Today's check-in"}
      />

      <ol className="grid gap-2">
        {progress.steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              "flex min-h-control items-center gap-3 rounded-control border px-4 py-3",
              step.state === "done" && "border-primary/45 bg-surface-2",
              step.state === "now" && "border-primary bg-surface",
              step.state === "up_next" && "border-border bg-surface"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0 rounded-pill border",
                stateIndicatorClass(step.state)
              )}
            />
            <span className="text-copy text-body">{step.label}</span>
            <span className="sr-only">{stateLabel(step.state)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function stateIndicatorClass(state: TrackerProgressStep["state"]): string {
  switch (state) {
    case "done":
      return "border-primary bg-primary";
    case "now":
      return "border-primary bg-transparent";
    case "up_next":
      return "border-border bg-transparent";
  }
}

function stateLabel(state: TrackerProgressStep["state"]): string {
  switch (state) {
    case "done":
      return "Completed step";
    case "now":
      return "Current step";
    case "up_next":
      return "Upcoming step";
  }
}
