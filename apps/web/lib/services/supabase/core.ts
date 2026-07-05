import {
  mapSupabaseError,
  normalizeServiceError,
  serviceFailure,
  serviceSuccess,
  type ServiceResult,
} from "../errors";
import type {
  AppSupabaseClient,
  ClientProfileRepository,
  ClientProfileSafeFields,
  ClientOnboardingAnswer,
  ClientOnboardingData,
  ClientOnboardingQuestion,
  CoachClientListItem,
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
} from "./types";
import type {
  ClientProfileRow,
  CoachClientRow,
  Json,
  OnboardingAnswerRow,
  OnboardingAssessmentVersionRow,
  OnboardingAttemptRow,
  OnboardingQuestionRow,
  ProfileRow,
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

class SupabaseDatabaseServiceImpl implements SupabaseDatabaseService {
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;
  readonly onboarding: OnboardingRepository;

  constructor(readonly client: AppSupabaseClient) {
    this.profiles = new SupabaseProfileRepository(client);
    this.coachClients = new SupabaseCoachClientRepository(client);
    this.clientProfiles = new SupabaseClientProfileRepository(client);
    this.onboarding = new SupabaseOnboardingRepository(client);
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
