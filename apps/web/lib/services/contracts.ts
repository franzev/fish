import type { ServiceResult } from "./errors";
import type { ChatGif, ChatStickerId } from "@fish/core/chat";
import type {
  EffectivePresenceStatus,
  PresencePreference,
  PresenceSnapshot,
} from "@fish/core/presence";
import type {
  NotificationChange,
  NotificationFilter,
  NotificationPage,
  NotificationSummary,
} from "@fish/core/notification-state";

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
  avatarPath: string | null;
  avatarThumbnailPath: string | null;
  avatarUpdatedAt: string | null;
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
export interface CoachClientListItem {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
}
export interface CoachClientRepository {
  findAssignmentForClient(clientId: string): Promise<ServiceResult<CoachAssignment | null>>;
  listAssignedClients(): Promise<ServiceResult<CoachClientListItem[]>>;
}

export interface LessonSlot {
  id: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  bookedByClientId: string | null;
  bookedAt: string | null;
}

export interface LessonRepository {
  listAvailable(
    coachId: string,
    afterIso?: string
  ): Promise<ServiceResult<LessonSlot[]>>;
  findUpcomingForClient(
    clientId: string,
    afterIso?: string
  ): Promise<ServiceResult<LessonSlot | null>>;
  findBookedByIdForClient(
    slotId: string,
    clientId: string
  ): Promise<ServiceResult<LessonSlot | null>>;
}

export interface ClientChatReaction { emoji: string; count: number; byMe: boolean }
export interface ClientChatAttachment {
  id: string; status: "ready"; kind?: "image" | "file"; originalName: string;
  mimeType?: string; byteSize?: number; width?: number; height?: number;
  thumbnailPath?: string; displayPath: string; thumbnailUrl?: string; displayUrl?: string;
}
export type ClientChatImage = ClientChatAttachment;
export type ClientChatGif = ChatGif;
export interface ClientChatMessage {
  id: string; conversationId: string; senderId: string; senderRole: "client" | "coach";
  senderDisplayName?: string | null; body: string; clientRequestId: string; createdAt: string;
  senderAvatarUrl?: string | null;
  editedAt?: string | null; deletedAt?: string | null; replyToMessageId?: string | null;
  pinnedAt?: string | null; pinnedBy?: string | null;
  reactions?: ClientChatReaction[];
  gif?: ClientChatGif;
  stickerId?: string;
  images?: ClientChatImage[];
}
export interface ClientChatParticipant {
  id: string;
  displayName: string;
  role: "client" | "coach";
  avatarUrl?: string | null;
}
export interface ClientChatSearchMember {
  id: string; displayName: string; username: string; avatarUrl?: string;
}
export interface ClientChatSearchChannel {
  id: string; name: string; slug: string; conversationId: string;
}
export interface ClientChatReadState { userId: string; lastDeliveredMessageId: string | null; deliveredAt: string | null; lastReadMessageId: string | null; readAt: string | null }
export interface ClientChatUnreadSummary {
  count: number;
  oldestUnreadAt: string | null;
  latestUnreadMessageId: string | null;
}
export interface ClientChatPresenceSession { id: string; userId: string; activeAt: string; lastHeartbeatAt: string; endedAt: string | null }
export interface ClientChatPresence { sessions: ClientChatPresenceSession[]; lastSeenAt: string | null }
export interface ClientChatData {
  conversationId: string; kind?: "direct" | "community"; channelId?: string; channelSlug?: string;
  channelName?: string; title?: string; subtitle?: string; currentUserId: string;
  currentUserRole: "client" | "coach"; currentUserDisplayName: string; participant: ClientChatParticipant;
  messages: ClientChatMessage[]; readStates?: ClientChatReadState[]; unreadSummary?: ClientChatUnreadSummary;
  participantPresence?: ClientChatPresence;
  searchMembers?: ClientChatSearchMember[]; searchChannels?: ClientChatSearchChannel[];
  hasMoreOlder?: boolean; oldestCursor?: { createdAt: string; id: string } | null;
}
export interface ChatRepository {
  getAssignedConversation(
    channelSlug?: string,
    conversationId?: string
  ): Promise<ServiceResult<ClientChatData | null>>;
  getUnreadSummary(
    conversationId: string
  ): Promise<ServiceResult<ClientChatUnreadSummary>>;
}
export interface ChatSearchResult {
  messages: ClientChatMessage[];
  nextCursor: { createdAt: string; id: string } | null;
  totalCount: number;
}
export interface ChatSearchInput {
  conversationId: string;
  text: string;
  senderIds: string[];
  mentionedUserIds: string[];
  channelIds: string[];
  contentKinds: Array<"image" | "video" | "link" | "file" | "embed">;
  authorTypes: Array<"client" | "coach">;
  pinned: boolean | null;
  dates: Array<{ operator: "before" | "after" | "during"; date: string; timeZone: string }>;
  cursor?: { createdAt: string; id: string } | null;
  offset?: number;
  sortDirection?: "asc" | "desc";
  limit?: number;
}
export interface ChatSearchRepository {
  search(input: ChatSearchInput): Promise<ChatOperationResult<ChatSearchResult>>;
}
export type { EffectivePresenceStatus, PresencePreference, PresenceSnapshot };

export interface PresenceRepository {
  listVisible(): Promise<ServiceResult<PresenceSnapshot[]>>;
  getOwnPreference(): Promise<ServiceResult<PresencePreference>>;
}

export interface DatabaseServices {
  profiles: ProfileRepository;
  coachClients: CoachClientRepository;
  clientProfiles: ClientProfileRepository;
  lessons: LessonRepository;
  chat: ChatRepository;
  chatSearch: ChatSearchRepository;
  friends: FriendRepository;
  notifications: NotificationRepository;
  attention: NavigationAttentionRepository;
  presence: PresenceRepository;
}
export interface AvatarUploadAuthorization {
  uploadId: string;
  bucket: "avatars";
  objectPath: string;
  uploadToken: string;
  signedUploadUrl: string;
  expiresAt: string;
}

export interface AvatarUrlItem {
  profileId: string;
  url: string;
  expiresAt: string;
}

export interface AvatarCommandService {
  initialize(input: {
    clientUploadId: string;
    originalName: string;
    sourceMimeType: string;
    sourceByteSize: number;
  }): Promise<AvatarUploadAuthorization>;
  complete(uploadId: string): Promise<{
    profileId: string;
    avatarUrl?: string;
    avatarThumbnailUrl?: string;
    updatedAt: string;
  }>;
  cancel(uploadId: string): Promise<void>;
  remove(): Promise<void>;
  resolveUrls(
    profileIds: string[],
    variant?: "thumbnail" | "display"
  ): Promise<AvatarUrlItem[]>;
}

export interface AppServices {
  auth: AuthService;
  database: DatabaseServices;
  avatars: AvatarCommandService;
}

export interface NotificationRepository {
  getSummary(): Promise<ServiceResult<NotificationSummary>>;
  listPage(input: {
    filter: NotificationFilter;
    cursor?: NotificationPage["nextCursor"];
    limit?: number;
  }): Promise<ServiceResult<NotificationPage>>;
  listChanges(afterChangeSeq: number): Promise<ServiceResult<NotificationChange[]>>;
}

export type NotificationCommand =
  | {
      action: "mark-seen" | "mark-read";
      notificationIds: string[];
      throughChangeSeq: number;
    }
  | { action: "mark-all-read" | "archive-read"; throughChangeSeq: number }
  | { action: "restore"; archiveBatchId: string }
  | { action: "acknowledge-moderation"; moderationActionId: string };

export type NotificationCommandResult =
  | { ok: true; updated: number; archiveBatchId?: string }
  | { ok: false; code: string; notice: string };

export interface NotificationCommandService {
  execute(command: NotificationCommand): Promise<NotificationCommandResult>;
}

export interface NotificationRealtimeHint {
  itemId: string;
  changeSeq: number;
  reason: string;
  occurredAt: string;
}

export interface NotificationRealtimeService {
  subscribe(
    userId: string,
    onHint: (hint: NotificationRealtimeHint) => void,
    onRecovery?: () => void,
    onStatus?: (status: "connected" | "disconnected") => void
  ): () => void;
}

export type PresenceCommandResult =
  | { ok: true; snapshot: PresenceSnapshot }
  | { ok: false; code: string; notice: string };

export interface PresenceCommandService {
  setMode(mode: PresencePreference): Promise<PresenceCommandResult>;
}

export interface PresenceRealtimeService {
  subscribe(
    userId: string,
    subjectIds: string[],
    onSnapshot: (snapshot: PresenceSnapshot) => void,
    onPreference: (preference: PresencePreference, revision: number) => void,
    onRecovery?: () => void,
    onStatus?: (status: "connected" | "disconnected") => void
  ): () => void;
  startSession(
    onSnapshot?: (snapshot: PresenceSnapshot) => void,
    onError?: () => void
  ): AppPresenceSessionController;
}

export interface AppPresenceSessionController {
  markActive(): void;
  stop(): void;
}

export interface NavigationAttention {
  surface: "channel" | "direct" | "friends";
  entityId: string | null;
  conversationId: string | null;
  unreadCount: number;
  mentionCount: number;
  newActivity: boolean;
}

export interface NavigationAttentionRepository {
  list(): Promise<ServiceResult<NavigationAttention[]>>;
}

export interface AttentionRealtimeService {
  subscribe(
    conversationIds: string[],
    onChange: (conversationId: string) => void,
    onRecovery?: () => void
  ): () => void;
}

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
  gif?: ClientChatGif;
  stickerId?: ChatStickerId;
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

export interface ReportGifInput {
  messageId: string;
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
  reportGif(input: ReportGifInput): Promise<ChatOperationResult<void>>;
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

export type ClientCallStatus =
  | "ringing"
  | "connecting"
  | "active"
  | "ended"
  | "rejected"
  | "cancelled"
  | "missed"
  | "failed";

export interface ClientCall {
  id: string;
  coachId: string;
  clientId: string;
  initiatedBy: string;
  kind: "audio" | "video";
  status: ClientCallStatus;
  expiresAt: string;
  acceptedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallConnection {
  serverUrl: string;
  participantToken: string;
}

export type CallCommandResult =
  | { ok: true; call: ClientCall; connection?: CallConnection }
  | { ok: false; code: string; notice: string };

export interface CallCommandService {
  initiate(input: {
    recipientId: string;
    kind: "audio" | "video";
    clientRequestId: string;
  }): Promise<CallCommandResult>;
  accept(callId: string): Promise<CallCommandResult>;
  reject(callId: string): Promise<CallCommandResult>;
  cancel(callId: string): Promise<CallCommandResult>;
  end(callId: string): Promise<CallCommandResult>;
  join(callId: string): Promise<CallCommandResult>;
}

export interface CallRealtimeEvent {
  callId: string;
  status: ClientCallStatus;
  occurredAt: string;
}

export interface CallRealtimeService {
  subscribe(
    userId: string,
    onEvent: (event: CallRealtimeEvent) => void,
    onRecovery?: () => void
  ): () => void;
  findCurrentCall(userId: string): Promise<
    | { call: ClientCall; counterpartName: string }
    | null
  >;
  findCall(callId: string, userId: string): Promise<
    | { call: ClientCall; counterpartName: string }
    | null
  >;
}

export type BookingCommandResult =
  | { ok: true; slot: LessonSlot }
  | { ok: false; code: string; notice: string };

export interface BookingCommandService {
  bookSlot(slotId: string): Promise<BookingCommandResult>;
}

export interface FriendProfile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}

export type FriendRelationshipStatus =
  | "none"
  | "outgoingPending"
  | "incomingPending"
  | "friends"
  | "unavailable";

export interface FriendCandidate {
  status: FriendRelationshipStatus;
  profile: FriendProfile | null;
  requestId: string | null;
}

export interface FriendListItem {
  friendshipId: string;
  friend: FriendProfile;
  since: string;
}

export interface FriendListPage {
  friends: FriendListItem[];
  nextCursor: { createdAt: string; id: string } | null;
}

export interface IncomingFriendRequest {
  requestId: string;
  sender: FriendProfile;
  createdAt: string;
}

export interface IncomingFriendRequestPage {
  requests: IncomingFriendRequest[];
  nextCursor: { createdAt: string; id: string } | null;
}

export type FriendNotificationKind =
  | "friendRequestReceived"
  | "friendRequestAccepted";

export interface FriendNotification {
  id: string;
  kind: FriendNotificationKind;
  actor: FriendProfile;
  entityId: string;
  readAt: string | null;
  createdAt: string;
}

export interface FriendRepository {
  searchCandidate(username: string): Promise<ServiceResult<FriendCandidate>>;
  listFriends(
    cursor?: { createdAt: string; id: string } | null
  ): Promise<ServiceResult<FriendListPage>>;
  listIncomingRequests(
    cursor?: { createdAt: string; id: string } | null
  ): Promise<ServiceResult<IncomingFriendRequestPage>>;
  getIncomingRequest(
    requestId: string
  ): Promise<ServiceResult<IncomingFriendRequest | null>>;
  countIncomingRequests(): Promise<ServiceResult<number>>;
  listNotifications(): Promise<ServiceResult<FriendNotification[]>>;
  listBlockedUsers(): Promise<ServiceResult<FriendProfile[]>>;
}

export type FriendRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";

export interface ClientFriendRequest {
  id: string;
  senderId: string;
  recipientId: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
}

export type FriendCommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; notice: string };

export interface FriendCommandService {
  sendRequest(input: {
    targetId: string;
    clientRequestId: string;
  }): Promise<FriendCommandResult<ClientFriendRequest>>;
  respondRequest(input: {
    requestId: string;
    response: "accept" | "decline";
  }): Promise<FriendCommandResult<ClientFriendRequest>>;
  cancelRequest(requestId: string): Promise<FriendCommandResult<ClientFriendRequest>>;
  removeFriend(targetId: string): Promise<FriendCommandResult<void>>;
  blockUser(targetId: string): Promise<FriendCommandResult<void>>;
  unblockUser(targetId: string): Promise<FriendCommandResult<void>>;
  markNotificationsRead(
    notificationIds: string[]
  ): Promise<FriendCommandResult<number>>;
}

export interface FriendRealtimeEvent {
  requestId?: string;
  friendshipId?: string;
  reason: string;
  occurredAt: string;
}

export interface FriendRealtimeService {
  subscribe(
    userId: string,
    onEvent: (event: FriendRealtimeEvent) => void,
    onRecovery?: () => void
  ): () => void;
}

export interface ServerServices extends AppServices {
  chatCommands: ChatCommandService;
  bookingCommands: BookingCommandService;
}

export interface ConversationTypingController { sendTyping(typing: boolean): void; unsubscribe(): void }
export interface ConversationRecordingController { sendRecording(recording: boolean): void; unsubscribe(): void }
export interface ChatRealtimeService {
  subscribeToMessages(conversationId: string, onMessage: (message: ClientChatMessage) => void, onReconnected?: () => void, onDisconnected?: () => void): () => void;
  subscribeToReadStates(conversationId: string, onReadState: (state: ClientChatReadState) => void, onReconnected?: () => void): () => void;
  subscribeToReactionChanges(conversationId: string, onReactionChange: (messageId: string) => void, onReconnected?: () => void): () => void;
  subscribeToTyping(conversationId: string, currentUserId: string, onChange: (typing: boolean) => void): ConversationTypingController;
  subscribeToRecording(conversationId: string, currentUserId: string, onChange: (recording: boolean) => void): ConversationRecordingController;
}
