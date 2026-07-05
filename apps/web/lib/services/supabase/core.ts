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
  CoachClientListItem,
  CoachClientRepository,
  ProfileRepository,
  SupabaseAuthService,
  SupabaseDatabaseService,
  SupabaseRealtimeService,
  SupabaseServices,
  SupabaseStorageService,
} from "./types";
import type { ClientProfileRow, CoachClientRow, ProfileRow } from "@fish/supabase";
import type { User } from "@supabase/supabase-js";

type SupabaseResponse<T> = {
  data: T | null;
  error: { message?: string; code?: string; name?: string; status?: number } | null;
};

function isAuthSessionMissingError(error: {
  message?: string;
  name?: string;
  status?: number;
}): boolean {
  return (
    error.name === "AuthSessionMissingError" ||
    error.message?.toLowerCase().includes("auth session missing") === true
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

class SupabaseDatabaseServiceImpl implements SupabaseDatabaseService {
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;

  constructor(readonly client: AppSupabaseClient) {
    this.profiles = new SupabaseProfileRepository(client);
    this.coachClients = new SupabaseCoachClientRepository(client);
    this.clientProfiles = new SupabaseClientProfileRepository(client);
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
