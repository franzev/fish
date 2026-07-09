import {
  generalChannelId,
  generalChannelName,
  generalChannelSlug,
} from "../../channels";
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
  CoachClientListItem,
  CoachClientRepository,
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
  MessageRow,
  MessageReactionRow,
  MessageReadRow,
  PresenceSessionRow,
  ConversationRow,
  ProfileRow,
} from "@fish/supabase";
import type { User } from "@supabase/supabase-js";

type SupabaseResponse<T> = {
  data: T | null;
  error: { message?: string; code?: string; name?: string; status?: number } | null;
};

const demoCommunityConversationId = "11111111-1111-4111-8111-111111111111";
const demoCommunityTitle = "FISH Community";

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

      const { data: demoConversation, error: demoConversationError } =
        (await this.client
          .from("conversations")
          .select("*")
          .eq("id", demoCommunityConversationId)
          .maybeSingle()) as SupabaseResponse<ConversationRow>;

      if (demoConversationError) {
        return serviceFailure(
          mapSupabaseError(demoConversationError, {
            code: "database",
            fallbackMessage: "Could not load the community room.",
            operation: "chat.getAssignedConversation.demoConversation",
            recoverable: true,
          })
        );
      }

      let conversation = demoConversation;

      if (!conversation) {
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

        conversation = conversations?.[0] ?? null;
      }

      if (!conversation) return serviceSuccess(null);

      const isDemoCommunity = conversation.id === demoCommunityConversationId;
      let participant: Pick<ProfileRow, "id" | "role" | "display_name"> = {
        id: demoCommunityConversationId,
        role: "coach",
        display_name: demoCommunityTitle,
      };

      if (!isDemoCommunity) {
        const participantId = conversation.client_id === userId
          ? conversation.coach_id
          : conversation.client_id;
        const { data: directParticipant, error: participantError } =
          (await this.client
            .from("profiles")
            .select("id, role, display_name")
            .eq("id", participantId)
            .maybeSingle()) as SupabaseResponse<
            Pick<ProfileRow, "id" | "role" | "display_name">
          >;

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

        if (
          !directParticipant ||
          (directParticipant.role !== "client" && directParticipant.role !== "coach")
        ) {
          return serviceSuccess(null);
        }

        participant = directParticipant;
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

      const senderIds = Array.from(
        new Set((messages ?? []).map((message) => message.sender_id))
      );
      const senderDisplayNames = new Map<string, string>();

      if (senderIds.length > 0) {
        const { data: senderProfiles, error: senderProfileError } =
          (await this.client
            .from("profiles")
            .select("id, display_name")
            .in("id", senderIds)) as {
            data: Array<Pick<ProfileRow, "id" | "display_name">> | null;
            error: SupabaseResponse<unknown>["error"];
          };

        if (senderProfileError) {
          return serviceFailure(
            mapSupabaseError(senderProfileError, {
              code: "database",
              fallbackMessage: "Could not load message senders.",
              operation: "chat.getAssignedConversation.senderProfiles",
              recoverable: true,
            })
          );
        }

        for (const senderProfile of senderProfiles ?? []) {
          senderDisplayNames.set(senderProfile.id, senderProfile.display_name);
        }
      }

      const { data: reactions, error: reactionError } = (await this.client
        .from("message_reactions")
        .select("*")
        .eq("conversation_id", conversation.id)) as {
        data: MessageReactionRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (reactionError) {
        return serviceFailure(
          mapSupabaseError(reactionError, {
            code: "database",
            fallbackMessage: "Could not load message reactions.",
            operation: "chat.getAssignedConversation.reactions",
            recoverable: true,
          })
        );
      }

      const { data: readStates, error: readStateError } = (await this.client
        .from("message_reads")
        .select("*")
        .eq("conversation_id", conversation.id)) as {
        data: MessageReadRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (readStateError) {
        return serviceFailure(
          mapSupabaseError(readStateError, {
            code: "database",
            fallbackMessage: "Could not load message read state.",
            operation: "chat.getAssignedConversation.reads",
            recoverable: true,
          })
        );
      }

      const { data: presenceSessions, error: presenceError } = (await this.client
        .from("presence_sessions")
        .select("*")
        .eq("user_id", participant.id)
        .order("last_heartbeat_at", { ascending: false })
        .limit(20)) as {
        data: PresenceSessionRow[] | null;
        error: SupabaseResponse<unknown>["error"];
      };

      if (presenceError) {
        return serviceFailure(
          mapSupabaseError(presenceError, {
            code: "database",
            fallbackMessage: "Could not load presence.",
            operation: "chat.getAssignedConversation.presence",
            recoverable: true,
          })
        );
      }

      const participantRole = participant.role === "client" ? "client" : "coach";

      return serviceSuccess({
        conversationId: conversation.id,
        kind: isDemoCommunity ? "community" : "direct",
        channelId: isDemoCommunity ? generalChannelId : undefined,
        channelSlug: isDemoCommunity ? generalChannelSlug : undefined,
        channelName: isDemoCommunity ? generalChannelName : undefined,
        // The simplified header renders "# general" from the channel name;
        // the old "FISH Community"/"Community room" title/subtitle pair is retired.
        title: isDemoCommunity ? generalChannelName : undefined,
        currentUserId: userId,
        currentUserRole: profile.role,
        currentUserDisplayName: profile.display_name,
        participant: {
          id: participant.id,
          displayName: participant.display_name,
          role: participantRole,
        },
        messages: (messages ?? []).map((message) =>
          toClientChatMessage(message, reactions ?? [], userId, senderDisplayNames)
        ),
        readStates: (readStates ?? []).map(toClientChatReadState),
        participantPresence: {
          sessions: (presenceSessions ?? []).map(toClientPresenceSession),
          lastSeenAt: getLastSeenAt(presenceSessions ?? []),
        },
      });
    });
  }
}

function toClientChatMessage(
  row: MessageRow,
  reactions: MessageReactionRow[] = [],
  currentUserId = "",
  senderDisplayNames: Map<string, string> = new Map()
): ClientChatMessage {
  const reactionCounts = new Map<string, { count: number; byMe: boolean }>();

  for (const reaction of reactions) {
    if (reaction.message_id !== row.id) {
      continue;
    }

    const current = reactionCounts.get(reaction.emoji) ?? {
      count: 0,
      byMe: false,
    };
    reactionCounts.set(reaction.emoji, {
      count: current.count + 1,
      byMe: current.byMe || reaction.user_id === currentUserId,
    });
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role as ClientChatMessage["senderRole"],
    senderDisplayName: senderDisplayNames.get(row.sender_id) ?? null,
    body: row.body,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    replyToMessageId: row.reply_to_message_id,
    reactions: Array.from(reactionCounts.entries()).map(([emoji, reaction]) => ({
      emoji,
      count: reaction.count,
      byMe: reaction.byMe,
    })),
  };
}

function toClientChatReadState(row: MessageReadRow) {
  return {
    userId: row.user_id,
    lastDeliveredMessageId: row.last_delivered_message_id,
    deliveredAt: row.delivered_at,
    lastReadMessageId: row.last_read_message_id,
    readAt: row.read_at,
  };
}

function toClientPresenceSession(row: PresenceSessionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    activeAt: row.active_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    endedAt: row.ended_at,
  };
}

function getLastSeenAt(rows: PresenceSessionRow[]): string | null {
  let latest: string | null = null;

  for (const row of rows) {
    const ended = row.ended_at ? Date.parse(row.ended_at) : Number.NaN;
    const heartbeat = Date.parse(row.last_heartbeat_at);
    const value = Number.isNaN(ended) || ended < heartbeat
      ? row.last_heartbeat_at
      : row.ended_at ?? row.last_heartbeat_at;

    if (!latest || Date.parse(latest) < Date.parse(value)) {
      latest = value;
    }
  }

  return latest;
}

class SupabaseDatabaseServiceImpl implements SupabaseDatabaseService {
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;
  readonly chat: ChatRepository;

  constructor(readonly client: AppSupabaseClient) {
    this.profiles = new SupabaseProfileRepository(client);
    this.coachClients = new SupabaseCoachClientRepository(client);
    this.clientProfiles = new SupabaseClientProfileRepository(client);
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
