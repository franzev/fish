import { Avatar } from "@/features/chat";
import { IconChevronRight } from "@tabler/icons-react";

interface CoachCardProps {
  coachId?: string | null;
  coachName: string | null;
  avatarUrl?: string | null;
}

/* Assigned, never chosen (AGENTS.md rule 2): a plain presentational row, not
   a link -- there is no coach-detail destination for the client this phase
   (D-11 only builds the COACH's read of a client, not the reverse). The
   chevron signals "this belongs to a bigger relationship", not "tap me".
   Non-focusable -> plain function export (no forwardRef needed). */
export function CoachCard({ coachId, coachName, avatarUrl }: CoachCardProps) {
  return (
    <div className="flex items-center gap-sm rounded-card bg-surface p-md">
      <Avatar
        profileId={coachId ?? undefined}
        src={avatarUrl ?? undefined}
        name={coachName ?? undefined}
        size="md"
        alt=""
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3xs">
        <span className="truncate text-foreground">
          {coachName ?? "Your coach"}
        </span>
        <span className="text-ui-sm text-muted">Your English coach</span>
      </div>
      <IconChevronRight
        size={20}
        stroke={1.75}
        aria-hidden="true"
        className="shrink-0 text-muted"
      />
    </div>
  );
}
