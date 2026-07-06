import {
  mapSupabaseError,
  normalizeServiceError,
  serviceFailure,
  serviceSuccess,
  type ServiceResult,
} from "../errors";
import type {
  AppSupabaseClient,
  ClientChatMessage,
  ClientChatData,
  ChatRepository,
  ClientProfileRepository,
  ClientProfileSafeFields,
  ClientTrackerAnswer,
  ClientTrackerData,
  ClientTrackerField,
  ClientOnboardingAnswer,
  ClientOnboardingData,
  ClientOnboardingQuestion,
  CoachClientListItem,
  CoachTrackerEntryField,
  CoachTrackerReviewData,
  CoachOnboardingReviewData,
  CoachClientRepository,
  OnboardingFinalizeResult,
  OnboardingQuestionForValidation,
  OnboardingRepository,
  OnboardingSaveResult,
  SaveOnboardingAnswerInput,
  ProfileRepository,
  SupabaseAuthService,
  SupabaseDatabaseService,
  SupabaseRealtimeService,
  SupabaseServices,
  SupabaseStorageService,
  SaveTrackerEntryInput,
  TrackerDraftResult,
  TrackerFieldForValidation,
  TrackerProgress,
  TrackerProgressStep,
  TrackerRepository,
  TrackerSaveResult,
} from "./types";
import type {
  ClientProfileRow,
  CoachClientRow,
  MessageRow,
  ConversationRow,
  Json,
  OnboardingAnswerRow,
  OnboardingAssessmentVersionRow,
  OnboardingAttemptRow,
  OnboardingQuestionRow,
  ProfileRow,
  TrackerAssignmentRow,
  TrackerConfigVersionRow,
  TrackerEntryDraftRow,
  TrackerEntryRow,
  TrackerFieldRow,
} from "@fish/supabase";
import type { FieldAnswer, FieldConfig, OnboardingReviewAnswer } from "@fish/core";
import type { User } from "@supabase/supabase-js";

type SupabaseResponse<T> = {
  data: T | null;
  error: { message?: string; code?: string; name?: string; status?: number } | null;
};

function isAuthSessionMissingError(error: {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
}): boolean {
  return (
    error.name === "AuthSessionMissingError" ||
    error.message?.toLowerCase().includes("auth session missing") === true
  );
}

function isSignedOutAuthError(error: {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
}): boolean {
  const message = error.message?.toLowerCase() ?? "";

  return (
    isAuthSessionMissingError(error) ||
    error.code === "refresh_token_not_found" ||
    error.code === "refresh_token_already_used" ||
    error.code === "session_not_found" ||
    error.code === "session_expired" ||
    (message.includes("invalid refresh token") &&
      (message.includes("refresh token not found") ||
        message.includes("already used")))
  );
}

async function safely<T>(
  operation: string,
  run: () => Promise<ServiceResult<T>>
): Promise<ServiceResult<T>> {
  try {
    return await run();
  } catch (error) {
    return serviceFailure(
      normalizeServiceError(error, {
        code: "unknown",
        message: "The service request failed.",
        operation,
      })
    );
  }
}

class SupabaseAuthServiceImpl implements SupabaseAuthService {
  constructor(readonly client: AppSupabaseClient) {}

  async getCurrentUser(): Promise<ServiceResult<User | null>> {
    return safely("auth.getCurrentUser", async () => {
      const { data, error } = await this.client.auth.getUser();
      if (error) {
        if (isAuthSessionMissingError(error)) {
          return serviceSuccess(null);
        }

        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not read the current user.",
            operation: "auth.getCurrentUser",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data.user);
    });
  }

  async refreshSessionClaims(): Promise<ServiceResult<void>> {
    return safely("auth.refreshSessionClaims", async () => {
      const { error } = await this.client.auth.getClaims();
      if (error) {
        if (isSignedOutAuthError(error)) {
          return serviceSuccess(undefined);
        }

        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not refresh the session.",
            operation: "auth.refreshSessionClaims",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<ServiceResult<void>> {
    return safely("auth.signInWithPassword", async () => {
      const { error } = await this.client.auth.signInWithPassword(input);
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not sign in.",
            operation: "auth.signInWithPassword",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async signUpWithPassword(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<ServiceResult<{ userId: string | null; identityCount: number | null }>> {
    return safely("auth.signUpWithPassword", async () => {
      const { data, error } = await this.client.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.displayName } },
      });

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not create the account.",
            operation: "auth.signUpWithPassword",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({
        userId: data.user?.id ?? null,
        identityCount: data.user?.identities?.length ?? null,
      });
    });
  }

  async signInWithGoogle(redirectTo: string): Promise<ServiceResult<void>> {
    return safely("auth.signInWithGoogle", async () => {
      const { error } = await this.client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not start Google sign-in.",
            operation: "auth.signInWithGoogle",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async resendSignupEmail(email: string): Promise<ServiceResult<void>> {
    return safely("auth.resendSignupEmail", async () => {
      const { error } = await this.client.auth.resend({ type: "signup", email });
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not resend the signup email.",
            operation: "auth.resendSignupEmail",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async requestPasswordReset(email: string): Promise<ServiceResult<void>> {
    return safely("auth.requestPasswordReset", async () => {
      const { error } = await this.client.auth.resetPasswordForEmail(email);
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not request a password reset.",
            operation: "auth.requestPasswordReset",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async updatePassword(password: string): Promise<ServiceResult<void>> {
    return safely("auth.updatePassword", async () => {
      const { error } = await this.client.auth.updateUser({ password });
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not update the password.",
            operation: "auth.updatePassword",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async signOut(): Promise<ServiceResult<void>> {
    return safely("auth.signOut", async () => {
      const { error } = await this.client.auth.signOut();
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not sign out.",
            operation: "auth.signOut",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }
}

class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async findById(id: string): Promise<ServiceResult<ProfileRow | null>> {
    return safely("profiles.findById", async () => {
      const { data, error } = (await this.client
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle()) as SupabaseResponse<ProfileRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load the profile.",
            operation: "profiles.findById",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data);
    });
  }

  async findRoleById(
    id: string
  ): Promise<ServiceResult<Pick<ProfileRow, "role"> | null>> {
    return safely("profiles.findRoleById", async () => {
      const { data, error } = (await this.client
        .from("profiles")
        .select("role")
        .eq("id", id)
        .maybeSingle()) as SupabaseResponse<Pick<ProfileRow, "role">>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load the profile role.",
            operation: "profiles.findRoleById",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data);
    });
  }

  async findDisplayNameById(
    id: string
  ): Promise<ServiceResult<Pick<ProfileRow, "display_name"> | null>> {
    return safely("profiles.findDisplayNameById", async () => {
      const { data, error } = (await this.client
        .from("profiles")
        .select("display_name")
        .eq("id", id)
        .maybeSingle()) as SupabaseResponse<Pick<ProfileRow, "display_name">>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load the profile display name.",
            operation: "profiles.findDisplayNameById",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data);
    });
  }

  async updateDisplayName(
    id: string,
    displayName: string
  ): Promise<ServiceResult<void>> {
    return safely("profiles.updateDisplayName", async () => {
      const { error } = await this.client
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", id);

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not save the display name.",
            operation: "profiles.updateDisplayName",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }
}

class SupabaseClientProfileRepository implements ClientProfileRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async findById(id: string): Promise<ServiceResult<ClientProfileRow | null>> {
    return safely("clientProfiles.findById", async () => {
      const { data, error } = (await this.client
        .from("client_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle()) as SupabaseResponse<ClientProfileRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load the profile details.",
            operation: "clientProfiles.findById",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data);
    });
  }

  async findByIdForCoach(
    id: string
  ): Promise<ServiceResult<ClientProfileRow | null>> {
    // Same query as findById -- RLS ("coach reads assigned client's
    // client_profile", 0007) does the coach scoping; an unassigned coach's
    // SELECT returns zero rows, not an error (default-deny, no leak, D-11).
    return safely("clientProfiles.findByIdForCoach", async () => {
      const { data, error } = (await this.client
        .from("client_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle()) as SupabaseResponse<ClientProfileRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load the client's profile details.",
            operation: "clientProfiles.findByIdForCoach",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data);
    });
  }

  async updateSafeFields(
    id: string,
    fields: ClientProfileSafeFields
  ): Promise<ServiceResult<void>> {
    return safely("clientProfiles.updateSafeFields", async () => {
      const { error } = await this.client
        .from("client_profiles")
        .update(fields)
        .eq("id", id);

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Couldn't save just now. Your text is still here — try again?",
            operation: "clientProfiles.updateSafeFields",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }
}

type ClientJoinRow = {
  client_id: string;
  profiles:
    | { id: string; display_name: string; email: string }
    | Array<{ id: string; display_name: string; email: string }>
    | null;
};

class SupabaseCoachClientRepository implements CoachClientRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async findAssignmentForClient(
    clientId: string
  ): Promise<ServiceResult<Pick<CoachClientRow, "coach_id"> | null>> {
    return safely("coachClients.findAssignmentForClient", async () => {
      const { data, error } = (await this.client
        .from("coach_clients")
        .select("coach_id")
        .eq("client_id", clientId)
        .maybeSingle()) as SupabaseResponse<Pick<CoachClientRow, "coach_id">>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load the coach assignment.",
            operation: "coachClients.findAssignmentForClient",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data);
    });
  }

  async listAssignedClients(): Promise<ServiceResult<CoachClientListItem[]>> {
    return safely("coachClients.listAssignedClients", async () => {
      const { data, error } = (await this.client
        .from("coach_clients")
        .select("client_id, profiles:client_id(id, display_name, email)")) as {
        data: ClientJoinRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load assigned clients.",
            operation: "coachClients.listAssignedClients",
            recoverable: true,
          })
        );
      }

      const clients = (data ?? [])
        .map((row) => {
          const client = Array.isArray(row.profiles)
            ? row.profiles[0]
            : row.profiles;
          if (!client) return null;
          return {
            id: client.id,
            displayName: client.display_name,
            email: client.email,
          };
        })
        .filter((client): client is CoachClientListItem => client !== null);

      return serviceSuccess(clients);
    });
  }
}

type ActiveAssessment = {
  version: OnboardingAssessmentVersionRow;
  questions: OnboardingQuestionRow[];
};

type SaveAnswerRpcRow = {
  answer_id: string;
  attempt_id: string;
  current_question_id: string | null;
  status: string;
};

type FinalizeAttemptRpcRow = {
  attempt_id: string;
  status: string;
  submitted_at: string;
};

class SupabaseOnboardingRepository implements OnboardingRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async getActiveAssessmentForClient(): Promise<ServiceResult<ClientOnboardingData | null>> {
    const activeResult = await this.loadActiveAssessment();
    if (!activeResult.ok) return activeResult;
    if (!activeResult.data) return serviceSuccess(null);

    return serviceSuccess(toClientOnboardingData(activeResult.data, null, []));
  }

  async getClientAttemptState(): Promise<ServiceResult<ClientOnboardingData | null>> {
    const activeResult = await this.loadActiveAssessment();
    if (!activeResult.ok) return activeResult;
    if (!activeResult.data) return serviceSuccess(null);

    const attemptResult = await this.loadAttempt(activeResult.data.version.id);
    if (!attemptResult.ok) return attemptResult;

    const answersResult = attemptResult.data
      ? await this.loadAnswers(attemptResult.data.id)
      : serviceSuccess<OnboardingAnswerRow[]>([]);
    if (!answersResult.ok) return answersResult;

    return serviceSuccess(
      toClientOnboardingData(
        activeResult.data,
        attemptResult.data,
        answersResult.data
      )
    );
  }

  async getQuestionForAnswerValidation(
    questionId: string
  ): Promise<ServiceResult<OnboardingQuestionForValidation | null>> {
    return safely("onboarding.getQuestionForAnswerValidation", async () => {
      const { data, error } = (await this.client
        .from("onboarding_questions")
        .select("*")
        .eq("id", questionId)
        .maybeSingle()) as SupabaseResponse<OnboardingQuestionRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load this question.",
            operation: "onboarding.getQuestionForAnswerValidation",
            recoverable: true,
          })
        );
      }

      if (!data) return serviceSuccess(null);

      return serviceSuccess({
        id: data.id,
        prompt: data.prompt,
        answerType: data.answer_type as FieldConfig["type"],
        config: data.config as unknown as FieldConfig,
        versionId: data.version_id,
      });
    });
  }

  async saveAnswer(
    input: SaveOnboardingAnswerInput
  ): Promise<ServiceResult<OnboardingSaveResult>> {
    return safely("onboarding.saveAnswer", async () => {
      const { data, error } = (await this.client.rpc("save_onboarding_answer", {
        p_question_id: input.questionId,
        p_answer: input.answer as unknown as Json,
      })) as { data: SaveAnswerRpcRow[] | null; error: SupabaseResponse<unknown>["error"] };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "That did not save yet. Keep this open and try again.",
            operation: "onboarding.saveAnswer",
            recoverable: true,
          })
        );
      }

      const row = data?.[0];
      if (!row) {
        return serviceFailure(
          normalizeServiceError(new Error("Missing save result."), {
            code: "database",
            message: "That did not save yet. Keep this open and try again.",
            operation: "onboarding.saveAnswer",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({
        attemptId: row.attempt_id,
        status: row.status as OnboardingSaveResult["status"],
        currentQuestionId: row.current_question_id,
      });
    });
  }

  async finalizeAttempt(): Promise<ServiceResult<OnboardingFinalizeResult>> {
    return safely("onboarding.finalizeAttempt", async () => {
      const { data, error } = (await this.client.rpc(
        "finalize_onboarding_attempt"
      )) as {
        data: FinalizeAttemptRpcRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "That did not save yet. Keep this open and try again.",
            operation: "onboarding.finalizeAttempt",
            recoverable: true,
          })
        );
      }

      const row = data?.[0];
      if (!row) {
        return serviceFailure(
          normalizeServiceError(new Error("Missing finalize result."), {
            code: "database",
            message: "That did not save yet. Keep this open and try again.",
            operation: "onboarding.finalizeAttempt",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({
        attemptId: row.attempt_id,
        status: "submitted",
        submittedAt: row.submitted_at,
      });
    });
  }

  async getCoachReview(
    clientId: string
  ): Promise<ServiceResult<CoachOnboardingReviewData | null>> {
    return safely("onboarding.getCoachReview", async () => {
      const { data: attempt, error } = (await this.client
        .from("onboarding_attempts")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()) as SupabaseResponse<OnboardingAttemptRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load onboarding answers.",
            operation: "onboarding.getCoachReview",
            recoverable: true,
          })
        );
      }

      if (!attempt) return serviceSuccess(null);

      const answersResult = await this.loadAnswers(attempt.id);
      if (!answersResult.ok) return answersResult;

      return serviceSuccess({
        attemptId: attempt.id,
        status: attempt.status as CoachOnboardingReviewData["status"],
        submittedAt: attempt.submitted_at,
        answers: answersResult.data.map(toReviewAnswer),
      });
    });
  }

  private async loadActiveAssessment(): Promise<ServiceResult<ActiveAssessment | null>> {
    return safely("onboarding.loadActiveAssessment", async () => {
      const { data: version, error: versionError } = (await this.client
        .from("onboarding_assessment_versions")
        .select("*")
        .eq("status", "published")
        .eq("is_active", true)
        .maybeSingle()) as SupabaseResponse<OnboardingAssessmentVersionRow>;

      if (versionError) {
        return serviceFailure(
          mapSupabaseError(versionError, {
            code: "database",
            fallbackMessage: "Could not load onboarding.",
            operation: "onboarding.loadActiveAssessment",
            recoverable: true,
          })
        );
      }

      if (!version) return serviceSuccess(null);

      const { data: questions, error: questionsError } = (await this.client
        .from("onboarding_questions")
        .select("*")
        .eq("version_id", version.id)
        .order("question_order", { ascending: true })) as {
        data: OnboardingQuestionRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (questionsError) {
        return serviceFailure(
          mapSupabaseError(questionsError, {
            code: "database",
            fallbackMessage: "Could not load onboarding questions.",
            operation: "onboarding.loadActiveAssessment.questions",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({ version, questions: questions ?? [] });
    });
  }

  private async loadAttempt(
    versionId: string
  ): Promise<ServiceResult<OnboardingAttemptRow | null>> {
    return safely("onboarding.loadAttempt", async () => {
      const { data, error } = (await this.client
        .from("onboarding_attempts")
        .select("*")
        .eq("version_id", versionId)
        .maybeSingle()) as SupabaseResponse<OnboardingAttemptRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load your saved onboarding answers.",
            operation: "onboarding.loadAttempt",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data);
    });
  }

  private async loadAnswers(
    attemptId: string
  ): Promise<ServiceResult<OnboardingAnswerRow[]>> {
    return safely("onboarding.loadAnswers", async () => {
      const { data, error } = (await this.client
        .from("onboarding_answers")
        .select("*")
        .eq("attempt_id", attemptId)
        .order("question_order", { ascending: true })) as {
        data: OnboardingAnswerRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load your saved onboarding answers.",
            operation: "onboarding.loadAnswers",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data ?? []);
    });
  }
}

function toClientOnboardingData(
  active: ActiveAssessment,
  attempt: OnboardingAttemptRow | null,
  answers: OnboardingAnswerRow[]
): ClientOnboardingData {
  const questions = active.questions.map(toClientQuestion);
  const savedAnswers = Object.fromEntries(
    answers.map((answer) => [
      answer.question_id,
      answer.answer as unknown as FieldAnswer,
    ])
  );

  return {
    versionId: active.version.id,
    status: attempt
      ? (attempt.status as ClientOnboardingData["status"])
      : "not_started",
    attemptId: attempt?.id ?? null,
    currentQuestionId:
      attempt?.current_question_id ?? questions[0]?.id ?? null,
    questions,
    answers: answers.map(toClientAnswer),
    savedAnswers,
  };
}

function toClientQuestion(row: OnboardingQuestionRow): ClientOnboardingQuestion {
  return {
    id: row.id,
    versionId: row.version_id,
    questionKey: row.question_key,
    questionOrder: row.question_order,
    prompt: row.prompt,
    answerType: row.answer_type as FieldConfig["type"],
    config: row.config as unknown as FieldConfig,
  };
}

function toClientAnswer(row: OnboardingAnswerRow): ClientOnboardingAnswer {
  return {
    id: row.id,
    questionId: row.question_id,
    questionKey: row.question_key,
    questionOrder: row.question_order,
    questionPrompt: row.question_prompt,
    config: row.question_config as unknown as FieldConfig,
    answer: row.answer as unknown as FieldAnswer,
    updatedAt: row.updated_at,
  };
}

function toReviewAnswer(row: OnboardingAnswerRow): OnboardingReviewAnswer {
  return {
    id: row.id,
    questionId: row.question_id,
    questionKey: row.question_key,
    questionOrder: row.question_order,
    questionPrompt: row.question_prompt,
    config: row.question_config as unknown as FieldConfig,
    answer: row.answer as unknown as FieldAnswer,
    answeredAt: row.updated_at,
  };
}

type TrackerAssignmentJoinRow = TrackerAssignmentRow & {
  tracker_config_versions:
    | (TrackerConfigVersionRow & {
        tracker_configs: { title: string } | Array<{ title: string }> | null;
      })
    | Array<
        TrackerConfigVersionRow & {
          tracker_configs: { title: string } | Array<{ title: string }> | null;
        }
      >
    | null;
  profiles: { display_name: string } | Array<{ display_name: string }> | null;
};

type TrackerRpcRow = {
  assignment_id: string;
  entry_id?: string;
  draft_id?: string;
  entry_date: string;
  status: string;
};

type TrackerProgressRpcRow = {
  entries_count: number | string;
  milestone_id: string;
  milestone_order: number | string;
  label: string;
  state: string;
  current_step_progress: number | string | null;
};

class SupabaseTrackerRepository implements TrackerRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async getActiveAssignmentForClient(): Promise<ServiceResult<ClientTrackerData | null>> {
    const assignmentResult = await this.loadActiveAssignment();
    if (!assignmentResult.ok) return assignmentResult;
    if (!assignmentResult.data) return serviceSuccess(null);

    const assignment = assignmentResult.data;
    const version = normalizeSingle(assignment.tracker_config_versions);
    if (!version) return serviceSuccess(null);

    const fieldsResult = await this.loadFields(version.id);
    if (!fieldsResult.ok) return fieldsResult;

    const entriesResult = await this.loadEntries(assignment.id);
    if (!entriesResult.ok) return entriesResult;

    const draftsResult = await this.loadDrafts(assignment.id);
    if (!draftsResult.ok) return draftsResult;

    const progressResult = await this.getProgress();
    if (!progressResult.ok) return progressResult;

    return serviceSuccess(
      toClientTrackerData(
        assignment,
        version,
        fieldsResult.data,
        entriesResult.data,
        draftsResult.data,
        progressResult.data
      )
    );
  }

  async getFieldForAnswerValidation(
    fieldId: string
  ): Promise<ServiceResult<TrackerFieldForValidation | null>> {
    return safely("tracker.getFieldForAnswerValidation", async () => {
      const { data, error } = (await this.client
        .from("tracker_fields")
        .select("*")
        .eq("id", fieldId)
        .maybeSingle()) as SupabaseResponse<TrackerFieldRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load this tracker field.",
            operation: "tracker.getFieldForAnswerValidation",
            recoverable: true,
          })
        );
      }

      if (!data) return serviceSuccess(null);

      return serviceSuccess({
        id: data.id,
        prompt: data.prompt,
        answerType: data.answer_type as FieldConfig["type"],
        config: data.config as unknown as FieldConfig,
        versionId: data.version_id,
      });
    });
  }

  async saveEntry(
    input: SaveTrackerEntryInput
  ): Promise<ServiceResult<TrackerSaveResult>> {
    return safely<TrackerSaveResult>("tracker.save_tracker_entry", async () => {
      const { data, error } = (await this.client.rpc("save_tracker_entry", {
        p_field_id: input.fieldId,
        p_answer: input.answer as unknown as Json,
      })) as { data: TrackerRpcRow[] | null; error: SupabaseResponse<unknown>["error"] };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "That did not save yet. Keep this open and try again.",
            operation: "tracker.save_tracker_entry",
            recoverable: true,
          })
        );
      }

      const row = data?.[0];
      if (!row?.entry_id) {
        return serviceFailure(
          normalizeServiceError(new Error("Missing tracker save result."), {
            code: "database",
            message: "That did not save yet. Keep this open and try again.",
            operation: "tracker.save_tracker_entry",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({
        assignmentId: row.assignment_id,
        entryId: row.entry_id,
        entryDate: row.entry_date,
        status: "active",
      });
    });
  }

  async saveDraft(
    input: SaveTrackerEntryInput
  ): Promise<ServiceResult<TrackerDraftResult>> {
    return safely<TrackerDraftResult>("tracker.save_tracker_draft", async () => {
      const { data, error } = (await this.client.rpc("save_tracker_draft", {
        p_field_id: input.fieldId,
        p_answer: input.answer as unknown as Json,
      })) as { data: TrackerRpcRow[] | null; error: SupabaseResponse<unknown>["error"] };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "That draft did not save yet. Keep this open and try again.",
            operation: "tracker.save_tracker_draft",
            recoverable: true,
          })
        );
      }

      const row = data?.[0];
      if (!row?.draft_id) {
        return serviceFailure(
          normalizeServiceError(new Error("Missing tracker draft result."), {
            code: "database",
            message: "That draft did not save yet. Keep this open and try again.",
            operation: "tracker.save_tracker_draft",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({
        assignmentId: row.assignment_id,
        draftId: row.draft_id,
        entryDate: row.entry_date,
        status: "draft",
      });
    });
  }

  async getProgress(): Promise<ServiceResult<TrackerProgress>> {
    return safely("tracker.getProgress", async () => {
      const { data, error } = (await this.client.rpc("get_tracker_progress")) as {
        data: TrackerProgressRpcRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load tracker progress.",
            operation: "tracker.getProgress",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(toTrackerProgress(data ?? []));
    });
  }

  private async loadDrafts(assignmentId: string): Promise<ServiceResult<TrackerEntryDraftRow[]>> {
    return safely("tracker.loadDrafts", async () => {
      const { data, error } = (await this.client
        .from("tracker_entry_drafts")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("field_order", { ascending: true })) as {
        data: TrackerEntryDraftRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load your draft tracker answers.",
            operation: "tracker.loadDrafts",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data ?? []);
    });
  }

  async getCoachReview(
    clientId: string
  ): Promise<ServiceResult<CoachTrackerReviewData | null>> {
    return safely("tracker.getCoachReview", async () => {
      const { data: assignment, error } = (await this.client
        .from("tracker_assignments")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle()) as SupabaseResponse<TrackerAssignmentRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load tracker entries.",
            operation: "tracker.getCoachReview",
            recoverable: true,
          })
        );
      }

      if (!assignment) return serviceSuccess(null);

      const entriesResult = await this.loadEntries(assignment.id);
      if (!entriesResult.ok) return entriesResult;

      return serviceSuccess({
        assignmentId: assignment.id,
        status: entriesResult.data.length > 0 ? "saved" : "empty",
        entries: groupCoachTrackerEntries(entriesResult.data),
      });
    });
  }

  private async loadActiveAssignment(): Promise<ServiceResult<TrackerAssignmentJoinRow | null>> {
    return safely("tracker.loadActiveAssignment", async () => {
      const { data, error } = (await this.client
        .from("tracker_assignments")
        .select(
          "*, tracker_config_versions:version_id(*, tracker_configs:tracker_config_id(title)), profiles:coach_id(display_name)"
        )
        .eq("status", "active")
        .maybeSingle()) as SupabaseResponse<TrackerAssignmentJoinRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load your tracker.",
            operation: "tracker.loadActiveAssignment",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data);
    });
  }

  private async loadFields(versionId: string): Promise<ServiceResult<TrackerFieldRow[]>> {
    return safely("tracker.loadFields", async () => {
      const { data, error } = (await this.client
        .from("tracker_fields")
        .select("*")
        .eq("version_id", versionId)
        .order("field_order", { ascending: true })) as {
        data: TrackerFieldRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load tracker fields.",
            operation: "tracker.loadFields",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data ?? []);
    });
  }

  private async loadEntries(assignmentId: string): Promise<ServiceResult<TrackerEntryRow[]>> {
    return safely("tracker.loadEntries", async () => {
      const { data, error } = (await this.client
        .from("tracker_entries")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("entry_date", { ascending: false })
        .order("field_order", { ascending: true })) as {
        data: TrackerEntryRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load tracker entries.",
            operation: "tracker.loadEntries",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data ?? []);
    });
  }

}

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toClientTrackerData(
  assignment: TrackerAssignmentJoinRow,
  version: TrackerConfigVersionRow & {
    tracker_configs: { title: string } | Array<{ title: string }> | null;
  },
  fields: TrackerFieldRow[],
  entries: TrackerEntryRow[],
  drafts: TrackerEntryDraftRow[],
  progress: TrackerProgress
): ClientTrackerData {
  const tracker = normalizeSingle(version.tracker_configs);
  const coach = normalizeSingle(assignment.profiles);
  const savedAnswers = toAnswerRecord(entries);
  const draftAnswers = toAnswerRecord(drafts);

  return {
    assignmentId: assignment.id,
    versionId: version.id,
    trackerName: tracker?.title ?? "Your tracker",
    cadence: version.cadence,
    coachDisplayName: coach?.display_name ?? null,
    fields: fields.map(toClientTrackerField),
    entries: entries.map(toClientTrackerAnswer),
    savedAnswers,
    draftAnswers,
    progress,
  };
}

function toClientTrackerField(row: TrackerFieldRow): ClientTrackerField {
  return {
    id: row.id,
    versionId: row.version_id,
    fieldKey: row.field_key,
    fieldOrder: row.field_order,
    prompt: row.prompt,
    answerType: row.answer_type as FieldConfig["type"],
    config: row.config as unknown as FieldConfig,
  };
}

function toClientTrackerAnswer(row: TrackerEntryRow): ClientTrackerAnswer {
  return {
    id: row.id,
    fieldId: row.field_id,
    fieldKey: row.field_key,
    fieldOrder: row.field_order,
    fieldPrompt: row.field_prompt,
    config: row.field_config as unknown as FieldConfig,
    answer: row.answer as unknown as FieldAnswer,
    entryDate: row.entry_date,
    updatedAt: row.updated_at,
    source: "saved",
  };
}

function toTrackerProgress(rows: TrackerProgressRpcRow[]): TrackerProgress {
  const entriesCount = rows[0] ? Number(rows[0].entries_count) : 0;

  return {
    entriesCount: Number.isFinite(entriesCount) ? entriesCount : 0,
    steps: rows.map(toTrackerProgressStep),
  };
}

function toAnswerRecord(
  rows: Array<TrackerEntryDraftRow | TrackerEntryRow>
): Record<string, FieldAnswer> {
  const answers: Record<string, FieldAnswer> = {};

  for (const row of rows) {
    answers[row.field_id] ??= row.answer as unknown as FieldAnswer;
  }

  return answers;
}

function toTrackerProgressStep(row: TrackerProgressRpcRow): TrackerProgressStep {
  const state =
    row.state === "done" || row.state === "now" || row.state === "up_next"
      ? row.state
      : "up_next";

  return {
    id: row.milestone_id,
    label: row.label,
    state,
    currentStepProgress: toBoundedProgress(row.current_step_progress),
  };
}

function toBoundedProgress(value: number | string | null): number {
  const progress = Number(value ?? 0);
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

function groupCoachTrackerEntries(
  rows: TrackerEntryRow[]
): CoachTrackerReviewData["entries"] {
  const groups = new Map<string, CoachTrackerEntryField[]>();

  for (const row of rows) {
    const fields = groups.get(row.entry_date) ?? [];
    fields.push({
      id: row.id,
      fieldId: row.field_id,
      fieldKey: row.field_key,
      fieldOrder: row.field_order,
      fieldPrompt: row.field_prompt,
      config: row.field_config as unknown as FieldConfig,
      answer: row.answer as unknown as FieldAnswer,
      updatedAt: row.updated_at,
    });
    groups.set(row.entry_date, fields);
  }

  return [...groups.entries()].map(([entryDate, fields]) => ({
    entryDate,
    fields: fields.sort((left, right) => left.fieldOrder - right.fieldOrder),
  }));
}

class SupabaseChatRepository implements ChatRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async getAssignedConversation(): Promise<ServiceResult<ClientChatData | null>> {
    return safely("chat.getAssignedConversation", async () => {
      const { data: userData, error: userError } = await this.client.auth.getUser();
      if (userError) {
        return serviceFailure(
          mapSupabaseError(userError, {
            code: "auth",
            fallbackMessage: "Could not read the current user.",
            operation: "chat.getAssignedConversation",
            recoverable: true,
          })
        );
      }

      const userId = userData.user?.id;
      if (!userId) return serviceSuccess(null);

      const { data: profile, error: profileError } = (await this.client
        .from("profiles")
        .select("id, role, display_name")
        .eq("id", userId)
        .maybeSingle()) as SupabaseResponse<Pick<ProfileRow, "id" | "role" | "display_name">>;

      if (profileError) {
        return serviceFailure(
          mapSupabaseError(profileError, {
            code: "database",
            fallbackMessage: "Could not load your profile.",
            operation: "chat.getAssignedConversation.profile",
            recoverable: true,
          })
        );
      }

      if (!profile || (profile.role !== "client" && profile.role !== "coach")) {
        return serviceSuccess(null);
      }

      const { data: conversations, error: conversationError } = (await this.client
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)) as {
        data: ConversationRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (conversationError) {
        return serviceFailure(
          mapSupabaseError(conversationError, {
            code: "database",
            fallbackMessage: "Could not load your conversation.",
            operation: "chat.getAssignedConversation.conversation",
            recoverable: true,
          })
        );
      }

      const conversation = conversations?.[0];
      if (!conversation) return serviceSuccess(null);

      const participantId = conversation.client_id === userId
        ? conversation.coach_id
        : conversation.client_id;
      const { data: participant, error: participantError } = (await this.client
        .from("profiles")
        .select("id, role, display_name")
        .eq("id", participantId)
        .maybeSingle()) as SupabaseResponse<Pick<ProfileRow, "id" | "role" | "display_name">>;

      if (participantError) {
        return serviceFailure(
          mapSupabaseError(participantError, {
            code: "database",
            fallbackMessage: "Could not load the conversation member.",
            operation: "chat.getAssignedConversation.participant",
            recoverable: true,
          })
        );
      }

      if (!participant || (participant.role !== "client" && participant.role !== "coach")) {
        return serviceSuccess(null);
      }

      const { data: messages, error: messageError } = (await this.client
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })) as {
        data: MessageRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (messageError) {
        return serviceFailure(
          mapSupabaseError(messageError, {
            code: "database",
            fallbackMessage: "Could not load messages.",
            operation: "chat.getAssignedConversation.messages",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({
        conversationId: conversation.id,
        currentUserId: userId,
        currentUserRole: profile.role,
        participant: {
          id: participant.id,
          displayName: participant.display_name,
          role: participant.role,
        },
        messages: (messages ?? []).map(toClientChatMessage),
      });
    });
  }
}

function toClientChatMessage(row: MessageRow): ClientChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role as ClientChatMessage["senderRole"],
    body: row.body,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
  };
}

class SupabaseDatabaseServiceImpl implements SupabaseDatabaseService {
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;
  readonly onboarding: OnboardingRepository;
  readonly tracker: TrackerRepository;
  readonly chat: ChatRepository;

  constructor(readonly client: AppSupabaseClient) {
    this.profiles = new SupabaseProfileRepository(client);
    this.coachClients = new SupabaseCoachClientRepository(client);
    this.clientProfiles = new SupabaseClientProfileRepository(client);
    this.onboarding = new SupabaseOnboardingRepository(client);
    this.tracker = new SupabaseTrackerRepository(client);
    this.chat = new SupabaseChatRepository(client);
  }
}

class SupabaseStorageServiceImpl implements SupabaseStorageService {
  constructor(readonly client: AppSupabaseClient) {}

  from(bucket: string): ReturnType<AppSupabaseClient["storage"]["from"]> {
    return this.client.storage.from(bucket);
  }
}

class SupabaseRealtimeServiceImpl implements SupabaseRealtimeService {
  constructor(readonly client: AppSupabaseClient) {}

  channel(
    topic: string,
    options?: Parameters<AppSupabaseClient["channel"]>[1]
  ): ReturnType<AppSupabaseClient["channel"]> {
    return this.client.channel(topic, options);
  }
}

/**
 * One factory builds the cohesive Supabase registry for every runtime. This is
 * the DI seam: tests can inject a fake client, and future services can compose
 * against interfaces instead of importing Supabase directly.
 */
export function createSupabaseServices(
  client: AppSupabaseClient
): SupabaseServices {
  return {
    client,
    auth: new SupabaseAuthServiceImpl(client),
    database: new SupabaseDatabaseServiceImpl(client),
    storage: new SupabaseStorageServiceImpl(client),
    realtime: new SupabaseRealtimeServiceImpl(client),
  };
}
