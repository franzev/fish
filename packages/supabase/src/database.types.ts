import type { UserRole } from "@fish/core/roles";
import type { Database as GeneratedDatabase, Json } from "./database.generated";

export type { Json };

// Canonical Database type: re-exports the generated schema (profiles, coach_clients --
// real migrated tables only). Regenerating database.generated.ts (via `supabase gen
// types`) never requires touching this file.
export type Database = GeneratedDatabase;

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type CoachClientRow = Database["public"]["Tables"]["coach_clients"]["Row"];
export type ClientProfileRow = Database["public"]["Tables"]["client_profiles"]["Row"];
export type OnboardingAssessmentRow = Database["public"]["Tables"]["onboarding_assessments"]["Row"];
export type OnboardingAssessmentVersionRow =
  Database["public"]["Tables"]["onboarding_assessment_versions"]["Row"];
export type OnboardingQuestionRow = Database["public"]["Tables"]["onboarding_questions"]["Row"];
export type OnboardingAttemptRow = Database["public"]["Tables"]["onboarding_attempts"]["Row"];
export type OnboardingAnswerRow = Database["public"]["Tables"]["onboarding_answers"]["Row"];
export type TrackerConfigRow = Database["public"]["Tables"]["tracker_configs"]["Row"];
export type TrackerConfigVersionRow =
  Database["public"]["Tables"]["tracker_config_versions"]["Row"];
export type TrackerFieldRow = Database["public"]["Tables"]["tracker_fields"]["Row"];
export type TrackerMilestoneRow = Database["public"]["Tables"]["tracker_milestones"]["Row"];
export type TrackerAssignmentRow = Database["public"]["Tables"]["tracker_assignments"]["Row"];
export type TrackerEntryRow = Database["public"]["Tables"]["tracker_entries"]["Row"];
export type TrackerEntryDraftRow = Database["public"]["Tables"]["tracker_entry_drafts"]["Row"];
export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type MessageReadRow = Database["public"]["Tables"]["message_reads"]["Row"];

// Re-exported for callers that still import UserRole via this module's historical surface.
export type { UserRole };
