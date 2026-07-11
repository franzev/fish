import type { ServiceResult } from "./errors";

export interface AuthUser {
  id: string;
  email?: string | null;
}

export type AuthSessionEvent =
  | "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED"
  | "USER_UPDATED" | "PASSWORD_RECOVERY" | "MFA_CHALLENGE_VERIFIED";

export interface AuthSession {
  user: AuthUser;
}

export type EmailTokenKind = "email" | "signup" | "invite" | "magiclink" | "recovery" | "email_change";

export interface AuthService {
  getCurrentUser(): Promise<ServiceResult<AuthUser | null>>;
  getAccessToken(): Promise<ServiceResult<string | null>>;
  exchangeCode(code: string): Promise<ServiceResult<void>>;
  verifyEmailToken(tokenHash: string, kind: EmailTokenKind): Promise<ServiceResult<void>>;
  subscribe(callback: (event: AuthSessionEvent, session: AuthSession | null) => void): () => void;
  refreshSessionClaims(): Promise<ServiceResult<void>>;
  signInWithPassword(input: { email: string; password: string }): Promise<ServiceResult<void>>;
  signUpWithPassword(input: { email: string; password: string; displayName: string }): Promise<ServiceResult<{ userId: string | null; identityCount: number | null }>>;
  signInWithGoogle(redirectTo: string): Promise<ServiceResult<void>>;
  resendSignupEmail(email: string): Promise<ServiceResult<void>>;
  requestPasswordReset(email: string): Promise<ServiceResult<void>>;
  updatePassword(password: string): Promise<ServiceResult<void>>;
  signOut(): Promise<ServiceResult<void>>;
}

export interface ProfileRecord { id: string; display_name: string; email: string; role: string; created_at: string; updated_at: string }
export interface CoachClientRecord { coach_id: string; client_id: string; assigned_at: string }
export interface ClientProfileRecord {
  id: string; goal: string; locale: string | null; timezone: string | null; level: string | null;
  theme_pref: string | null; text_size_pref: string | null; reduced_motion_pref: boolean | null;
  time_format_pref: string | null; consented: boolean; consented_at: string | null;
  consent_version: string | null; created_at: string; updated_at: string;
}

export type ClientProfileSafeFields = Partial<Pick<ClientProfileRecord,
  "goal" | "locale" | "timezone" | "theme_pref" | "text_size_pref" |
  "reduced_motion_pref" | "time_format_pref" | "consented" | "consented_at" | "consent_version">>;

export interface ProfileRepository {
  findById(id: string): Promise<ServiceResult<ProfileRecord | null>>;
  findRoleById(id: string): Promise<ServiceResult<Pick<ProfileRecord, "role"> | null>>;
  findDisplayNameById(id: string): Promise<ServiceResult<Pick<ProfileRecord, "display_name"> | null>>;
  updateDisplayName(id: string, displayName: string): Promise<ServiceResult<void>>;
}
export interface ClientProfileRepository {
  findById(id: string): Promise<ServiceResult<ClientProfileRecord | null>>;
  findByIdForCoach(id: string): Promise<ServiceResult<ClientProfileRecord | null>>;
  updateSafeFields(id: string, fields: ClientProfileSafeFields): Promise<ServiceResult<void>>;
}
export interface CoachClientListItem { id: string; displayName: string; email: string }
export interface CoachClientRepository {
  findAssignmentForClient(clientId: string): Promise<ServiceResult<Pick<CoachClientRecord, "coach_id"> | null>>;
  listAssignedClients(): Promise<ServiceResult<CoachClientListItem[]>>;
}

export interface ClientChatReaction { emoji: string; count: number; byMe: boolean }
export interface ClientChatMessage {
  id: string; conversationId: string; senderId: string; senderRole: "client" | "coach";
  senderDisplayName?: string | null; body: string; clientRequestId: string; createdAt: string;
  editedAt?: string | null; deletedAt?: string | null; replyToMessageId?: string | null;
  reactions?: ClientChatReaction[];
}
export interface ClientChatParticipant { id: string; displayName: string; role: "client" | "coach" }
export interface ClientChatReadState { userId: string; lastDeliveredMessageId: string | null; deliveredAt: string | null; lastReadMessageId: string | null; readAt: string | null }
export interface ClientChatPresenceSession { id: string; userId: string; activeAt: string; lastHeartbeatAt: string; endedAt: string | null }
export interface ClientChatPresence { sessions: ClientChatPresenceSession[]; lastSeenAt: string | null }
export interface ClientChatData {
  conversationId: string; kind?: "direct" | "community"; channelId?: string; channelSlug?: string;
  channelName?: string; title?: string; subtitle?: string; currentUserId: string;
  currentUserRole: "client" | "coach"; currentUserDisplayName: string; participant: ClientChatParticipant;
  messages: ClientChatMessage[]; readStates?: ClientChatReadState[]; participantPresence?: ClientChatPresence;
  hasMoreOlder?: boolean; oldestCursor?: { createdAt: string; id: string } | null;
}
export interface ChatRepository { getAssignedConversation(): Promise<ServiceResult<ClientChatData | null>> }
export interface DatabaseServices {
  profiles: ProfileRepository;
  coachClients: CoachClientRepository;
  clientProfiles: ClientProfileRepository;
  chat: ChatRepository;
}
export interface AppServices { auth: AuthService; database: DatabaseServices }
