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
  ProfileRow,
} from "@fish/supabase";

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
  signInWithGoogle(redirectTo: string): Promise<ServiceResult<void>>;
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
    | "time_format_pref"
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

export interface ClientChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "client" | "coach";
  body: string;
  clientRequestId: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToMessageId?: string | null;
  reactions?: ClientChatReaction[];
}

export interface ClientChatReaction {
  emoji: string;
  count: number;
  byMe: boolean;
}

export interface ClientChatParticipant {
  id: string;
  displayName: string;
  role: "client" | "coach";
}

export interface ClientChatReadState {
  userId: string;
  lastDeliveredMessageId: string | null;
  deliveredAt: string | null;
  lastReadMessageId: string | null;
  readAt: string | null;
}

export interface ClientChatPresenceSession {
  id: string;
  userId: string;
  activeAt: string;
  lastHeartbeatAt: string;
  endedAt: string | null;
}

export interface ClientChatPresence {
  sessions: ClientChatPresenceSession[];
  lastSeenAt: string | null;
}

export interface ClientChatData {
  conversationId: string;
  currentUserId: string;
  currentUserRole: "client" | "coach";
  participant: ClientChatParticipant;
  messages: ClientChatMessage[];
  readStates?: ClientChatReadState[];
  participantPresence?: ClientChatPresence;
}

export interface ChatRepository {
  getAssignedConversation(): Promise<ServiceResult<ClientChatData | null>>;
}

export interface SupabaseDatabaseService {
  readonly client: AppSupabaseClient;
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;
  readonly chat: ChatRepository;
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
