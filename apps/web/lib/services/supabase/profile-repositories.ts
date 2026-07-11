import {
  mapSupabaseError,
  serviceFailure,
  serviceSuccess,
  type ServiceResult,
} from "@/lib/services/errors";
import type { ClientProfileRow, CoachClientRow, ProfileRow } from "@fish/supabase";
import { safely, type SupabaseResponse } from "./shared";
import type {
  AppSupabaseClient,
  ClientProfileRepository,
  ClientProfileSafeFields,
  CoachClientListItem,
  CoachClientRepository,
  ProfileRepository,
} from "./types";

export class SupabaseProfileRepository implements ProfileRepository {
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

export class SupabaseClientProfileRepository implements ClientProfileRepository {
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

export class SupabaseCoachClientRepository implements CoachClientRepository {
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
