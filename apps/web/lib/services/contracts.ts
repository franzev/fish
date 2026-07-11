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

export type EmailTokenKind =
  | "email"
  | "signup"
  | "invite"
  | "magicLink"
  | "recovery"
  | "emailChange";

export interface AuthService {
  getCurrentUser(): Promise<ServiceResult<AuthUser | null>>;
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

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachAssignment {
  coachId: string;
}

export interface ClientProfile {
  id: string;
  goal: string;
  locale: string | null;
  timezone: string | null;
  level: string | null;
  themePref: string | null;
  textSizePref: string | null;
  reducedMotionPref: boolean | null;
  timeFormatPref: string | null;
  consented: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClientProfileUpdate = Partial<
  Pick<
    ClientProfile,
    | "goal"
    | "locale"
    | "timezone"
    | "themePref"
    | "textSizePref"
    | "reducedMotionPref"
    | "timeFormatPref"
    | "consented"
    | "consentedAt"
    | "consentVersion"
  >
>;

export interface ProfileRepository {
  findById(id: string): Promise<ServiceResult<Profile | null>>;
  findRoleById(id: string): Promise<ServiceResult<Pick<Profile, "role"> | null>>;
  findDisplayNameById(id: string): Promise<ServiceResult<Pick<Profile, "displayName"> | null>>;
  updateDisplayName(id: string, displayName: string): Promise<ServiceResult<void>>;
}
export interface ClientProfileRepository {
  findById(id: string): Promise<ServiceResult<ClientProfile | null>>;
  findByIdForCoach(id: string): Promise<ServiceResult<ClientProfile | null>>;
  updateSafeFields(id: string, fields: ClientProfileUpdate): Promise<ServiceResult<void>>;
}
export interface CoachClientListItem { id: string; displayName: string; email: string }
export interface CoachClientRepository {
  findAssignmentForClient(clientId: string): Promise<ServiceResult<CoachAssignment | null>>;
  listAssignedClients(): Promise<ServiceResult<CoachClientListItem[]>>;
}

export interface ClientChatReaction { emoji: string; count: number; byMe: boolean }
export interface ClientChatAttachment {
  id: string; status: "ready"; kind?: "image" | "file"; originalName: string;
  mimeType?: string; byteSize?: number; width?: number; height?: number;
  thumbnailPath?: string; displayPath: string; thumbnailUrl?: string; displayUrl?: string;
}
export type ClientChatImage = ClientChatAttachment;
export interface ClientChatMessage {
  id: string; conversationId: string; senderId: string; senderRole: "client" | "coach";
  senderDisplayName?: string | null; body: string; clientRequestId: string; createdAt: string;
  editedAt?: string | null; deletedAt?: string | null; replyToMessageId?: string | null;
  reactions?: ClientChatReaction[];
  images?: ClientChatImage[];
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

export interface ChatImageUploadAuthorization {
  attachmentId: string;
  bucket: string;
  objectPath: string;
  uploadToken: string;
  uploadMimeType: string;
  tusEndpoint: string;
  signedUploadUrl: string;
}
export interface ReadyChatImageUpload {
  attachment: ClientChatAttachment;
  urls: Array<{ path: string; signedUrl: string }>;
}
export interface ChatImageService {
  initialize(input: {
    conversationId: string;
    clientUploadId: string;
    originalName: string;
    sourceMimeType: string;
    sourceByteSize: number;
  }): Promise<ChatImageUploadAuthorization>;
  complete(attachmentId: string): Promise<ReadyChatImageUpload>;
  cancel(attachmentId: string): Promise<void>;
  refreshUrls(attachmentIds: string[]): Promise<Array<{ path: string; signedUrl: string }>>;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  clientRequestId: string;
  replyToMessageId?: string | null;
  attachmentIds?: string[];
}

export interface EditMessageInput {
  messageId: string;
  body: string;
}

export interface DeleteMessageInput {
  messageId: string;
}

export interface ToggleReactionInput {
  messageId: string;
  emoji: string;
}

export type ChatMessageCommand =
  | ({ kind: "edit" } & EditMessageInput)
  | ({ kind: "delete" } & DeleteMessageInput)
  | ({ kind: "toggleReaction" } & ToggleReactionInput);

export interface MarkReadStateInput {
  conversationId: string;
  lastDeliveredMessageId: string | null;
  lastReadMessageId: string | null;
}

export interface RefreshMessagesInput {
  messageIds: string[];
}

export interface ConversationInput {
  conversationId: string;
}

export interface LoadOlderMessagesInput extends ConversationInput {
  cursor?: { createdAt: string; id: string } | null;
  limit?: number;
}

export interface BackfillMessagesInput extends ConversationInput {
  afterCreatedAt: string;
  afterMessageId: string;
  limit?: number;
}

export interface LoadNewestMessagesInput extends ConversationInput {
  limit?: number;
}

export type ChatOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; notice: string };

export interface ChatCommandService {
  sendMessage(input: SendMessageInput): Promise<ChatOperationResult<ClientChatMessage>>;
  executeMessageCommand(
    command: ChatMessageCommand
  ): Promise<ChatOperationResult<ClientChatMessage>>;
  markReadState(
    input: MarkReadStateInput
  ): Promise<ChatOperationResult<ClientChatReadState>>;
  refreshMessages(
    input: RefreshMessagesInput
  ): Promise<ChatOperationResult<ClientChatMessage[]>>;
  refreshConversation(
    input: ConversationInput
  ): Promise<
    ChatOperationResult<{
      messages: ClientChatMessage[];
      readStates: ClientChatReadState[];
    }>
  >;
  loadOlderMessages(
    input: LoadOlderMessagesInput
  ): Promise<
    ChatOperationResult<{
      messages: ClientChatMessage[];
      hasMoreOlder: boolean;
    }>
  >;
  backfillMessages(
    input: BackfillMessagesInput
  ): Promise<
    ChatOperationResult<{
      messages: ClientChatMessage[];
      needsReset: boolean;
    }>
  >;
  loadNewestMessages(
    input: LoadNewestMessagesInput
  ): Promise<
    ChatOperationResult<{
      messages: ClientChatMessage[];
      readStates: ClientChatReadState[];
      hasMoreOlder: boolean;
      oldestCursor: { createdAt: string; id: string } | null;
    }>
  >;
}

export interface ServerServices extends AppServices {
  chatCommands: ChatCommandService;
}

export interface ConversationTypingController { sendTyping(typing: boolean): void; unsubscribe(): void }
export interface ConversationRecordingController { sendRecording(recording: boolean): void; unsubscribe(): void }
export interface PresenceSessionController { markActive(): void; stop(): void }
export interface ChatRealtimeService {
  subscribeToMessages(conversationId: string, onMessage: (message: ClientChatMessage) => void, onReconnected?: () => void, onDisconnected?: () => void): () => void;
  subscribeToReadStates(conversationId: string, onReadState: (state: ClientChatReadState) => void, onReconnected?: () => void): () => void;
  subscribeToReactionChanges(conversationId: string, onReactionChange: (messageId: string) => void, onReconnected?: () => void): () => void;
  subscribeToParticipantPresence(participantId: string, onPresence: (session: ClientChatPresenceSession, event: "INSERT" | "UPDATE" | "DELETE") => void): () => void;
  subscribeToTyping(conversationId: string, currentUserId: string, onChange: (typing: boolean) => void): ConversationTypingController;
  subscribeToRecording(conversationId: string, currentUserId: string, onChange: (recording: boolean) => void): ConversationRecordingController;
  startPresenceSession(currentUserId: string): PresenceSessionController;
}
