import type { CoachTrackerReviewData } from "@/lib/services";
import { formatAnswer } from "@/components/onboarding/format-answer";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

interface CoachTrackerReviewProps {
  review: CoachTrackerReviewData | null;
}

export function CoachTrackerReview({ review }: CoachTrackerReviewProps) {
  const entries = review?.entries ?? [];

  if (!review || entries.length === 0) {
    return (
      <Card className="space-y-2">
        <h2 className="font-display text-heading text-foreground">
          No tracker entries yet
        </h2>
        <p className="text-copy text-body">
          Saved client entries will appear here when they are ready.
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="tracker-review-heading">
      <div className="space-y-1">
        <h2
          id="tracker-review-heading"
          className="font-display text-heading text-foreground"
        >
          Tracker entries
        </h2>
        <p className="text-ui text-muted">
          Read-only saved check-ins from this client.
        </p>
      </div>

      {review.status === "empty" && (
        <Alert tone="notice">Nothing needs action yet.</Alert>
      )}

      <div className="space-y-3">
        {entries.map((entry) => (
          <Card key={entry.entryDate} className="space-y-3">
            <h3 className="text-copy font-semibold text-foreground">
              {entry.entryDate}
            </h3>
            <div className="space-y-3">
              {entry.fields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <p className="text-ui-sm text-muted">{field.fieldPrompt}</p>
                  <p className="whitespace-pre-wrap text-copy text-body">
                    {formatAnswer(field.config, field.answer)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
