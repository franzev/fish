import type { Database } from "@fish/supabase";
import type {
  RealtimeChannel,
  RealtimeChannelOptions,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";
import type { ServiceResult } from "../errors";
import type {
  ClientProfileRow,
  CoachClientRow,
  OnboardingAnswerRow,
  OnboardingAttemptRow,
  OnboardingQuestionRow,
  ProfileRow,
} from "@fish/supabase";
import type {
  FieldAnswer,
  FieldConfig,
  OnboardingAttemptStatus,
  OnboardingQuestion,
  OnboardingReviewAnswer,
} from "@fish/core";

export type { ClientProfileRow };

export type AppSupabaseClient = SupabaseClient<Database>;

export interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export interface MutableCookieStore {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: CookieOptions): void;
}

export interface SupabaseAuthService {
  readonly client: AppSupabaseClient;
  getCurrentUser(): Promise<ServiceResult<User | null>>;
  refreshSessionClaims(): Promise<ServiceResult<void>>;
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<ServiceResult<void>>;
  signUpWithPassword(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<ServiceResult<{ userId: string | null; identityCount: number | null }>>;
  resendSignupEmail(email: string): Promise<ServiceResult<void>>;
  requestPasswordReset(email: string): Promise<ServiceResult<void>>;
  updatePassword(password: string): Promise<ServiceResult<void>>;
  signOut(): Promise<ServiceResult<void>>;
}

export interface ProfileRepository {
  findById(id: string): Promise<ServiceResult<ProfileRow | null>>;
  findRoleById(id: string): Promise<ServiceResult<Pick<ProfileRow, "role"> | null>>;
  findDisplayNameById(
    id: string
  ): Promise<ServiceResult<Pick<ProfileRow, "display_name"> | null>>;
  updateDisplayName(id: string, displayName: string): Promise<ServiceResult<void>>;
}

/* Column-scoped, matching the 0007 GRANT UPDATE(...) list exactly (D-08).
   `level` and `id`/timestamps are deliberately excluded from this type so no
   caller can construct an update payload that touches the protected field --
   defense-in-depth at the type layer, above the DB grant + trigger. */
export type ClientProfileSafeFields = Partial<
  Pick<
    ClientProfileRow,
    | "goal"
    | "locale"
    | "timezone"
    | "theme_pref"
    | "text_size_pref"
    | "reduced_motion_pref"
    | "consented"
    | "consented_at"
    | "consent_version"
  >
>;

export interface ClientProfileRepository {
  findById(id: string): Promise<ServiceResult<ClientProfileRow | null>>;
  findByIdForCoach(id: string): Promise<ServiceResult<ClientProfileRow | null>>;
  updateSafeFields(
    id: string,
    fields: ClientProfileSafeFields
  ): Promise<ServiceResult<void>>;
}

export interface CoachClientListItem {
  id: string;
  displayName: string;
  email: string;
}

export interface CoachClientRepository {
  findAssignmentForClient(
    clientId: string
  ): Promise<ServiceResult<Pick<CoachClientRow, "coach_id"> | null>>;
  listAssignedClients(): Promise<ServiceResult<CoachClientListItem[]>>;
}

export interface ClientOnboardingQuestion extends OnboardingQuestion {
  versionId: string;
  answerType: FieldConfig["type"];
}

export interface ClientOnboardingAnswer {
  id: string;
  questionId: string;
  questionKey: string;
  questionOrder: number;
  questionPrompt: string;
  config: FieldConfig;
  answer: FieldAnswer;
  updatedAt: string;
}

export interface ClientOnboardingData {
  versionId: string;
  status: OnboardingAttemptStatus | "not_started";
  attemptId: string | null;
  currentQuestionId: string | null;
  questions: ClientOnboardingQuestion[];
  answers: ClientOnboardingAnswer[];
  savedAnswers: Record<string, FieldAnswer>;
}

export interface OnboardingQuestionForValidation {
  id: string;
  prompt: string;
  answerType: FieldConfig["type"];
  config: FieldConfig;
  versionId: string;
}

export interface SaveOnboardingAnswerInput {
  questionId: string;
  answer: FieldAnswer;
}

export interface OnboardingSaveResult {
  attemptId: string;
  status: OnboardingAttemptStatus;
  currentQuestionId: string | null;
}

export interface OnboardingFinalizeResult {
  attemptId: string;
  status: "submitted";
  submittedAt: string;
}

export interface CoachOnboardingReviewData {
  attemptId: string;
  status: OnboardingAttemptStatus;
  submittedAt: string | null;
  answers: OnboardingReviewAnswer[];
}

export interface OnboardingRepository {
  getActiveAssessmentForClient(): Promise<ServiceResult<ClientOnboardingData | null>>;
  getClientAttemptState(): Promise<ServiceResult<ClientOnboardingData | null>>;
  getQuestionForAnswerValidation(
    questionId: string
  ): Promise<ServiceResult<OnboardingQuestionForValidation | null>>;
  saveAnswer(
    input: SaveOnboardingAnswerInput
  ): Promise<ServiceResult<OnboardingSaveResult>>;
  finalizeAttempt(): Promise<ServiceResult<OnboardingFinalizeResult>>;
  getCoachReview(
    clientId: string
  ): Promise<ServiceResult<CoachOnboardingReviewData | null>>;
}

export type OnboardingSourceRows = {
  question: OnboardingQuestionRow;
  attempt: OnboardingAttemptRow;
  answer: OnboardingAnswerRow;
};

export interface SupabaseDatabaseService {
  readonly client: AppSupabaseClient;
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;
  readonly onboarding: OnboardingRepository;
}

export interface SupabaseStorageService {
  readonly client: AppSupabaseClient;
  from(bucket: string): ReturnType<AppSupabaseClient["storage"]["from"]>;
}

export interface SupabaseRealtimeService {
  readonly client: AppSupabaseClient;
  channel(
    topic: string,
    options?: RealtimeChannelOptions
  ): RealtimeChannel;
}

export interface SupabaseServices {
  readonly client: AppSupabaseClient;
  readonly auth: SupabaseAuthService;
  readonly database: SupabaseDatabaseService;
  readonly storage: SupabaseStorageService;
  readonly realtime: SupabaseRealtimeService;
}
