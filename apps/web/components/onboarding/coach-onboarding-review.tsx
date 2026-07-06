import type { CoachOnboardingReviewData } from "@/lib/services";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { formatAnswer } from "./format-answer";

interface CoachOnboardingReviewProps {
  review: CoachOnboardingReviewData | null;
}

export function CoachOnboardingReview({ review }: CoachOnboardingReviewProps) {
  const answers = [...(review?.answers ?? [])].sort(
    (left, right) => left.questionOrder - right.questionOrder
  );

  if (!review || answers.length === 0) {
    return (
      <Card className="space-y-2">
        <h2 className="font-display text-heading text-foreground">
          No onboarding answers yet
        </h2>
        <p className="text-copy text-body">
          When this client starts, their answers will appear here.
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="onboarding-review-heading">
      <div className="space-y-1">
        <h2
          id="onboarding-review-heading"
          className="font-display text-heading text-foreground"
        >
          Onboarding answers
        </h2>
        <p className="text-ui text-muted">
          Read-only context from the assessment this client saw.
        </p>
      </div>

      {review.status === "in_progress" && (
        <Alert tone="notice">
          <span className="block font-semibold text-foreground">
            Answers are still in progress
          </span>
          <span className="block">
            Review what has been saved so far. Nothing needs action yet.
          </span>
        </Alert>
      )}

      <div className="space-y-3">
        {answers.map((answer) => (
          <Card key={answer.id} className="space-y-2">
            <h3 className="text-copy font-semibold text-foreground">
              {answer.questionPrompt}
            </h3>
            <p className="whitespace-pre-wrap text-copy text-body">
              {formatAnswer(answer.config, answer.answer)}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
