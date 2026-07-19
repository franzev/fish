import type { ChatGif, ChatStickerId } from "@fish/core/chat";
import type { ServiceResult } from "../errors";

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
  attachments?: ClientChatAttachment[];
  /** @deprecated Use attachments. */
  images?: ClientChatImage[];
}

export interface ClientChatParticipant {
  id: string;
  displayName: string;
  role: "client" | "coach";
  avatarUrl?: string | null;
}

export interface ClientDirectConversationPreview {
  conversationId: string;
  participant: ClientChatParticipant;
  latestMessage: { senderId: string; text: string; createdAt: string } | null;
  unreadCount: number;
}

export interface ClientChatSearchMember {
  id: string; displayName: string; username: string; role?: "client" | "coach"; avatarUrl?: string;
}
export interface ClientChatSearchChannel {
  id: string; name: string; slug: string; conversationId: string;
}
export interface ClientChatReadState {
  userId: string;
  lastDeliveredMessageId: string | null;
  deliveredAt: string | null;
  lastReadMessageId: string | null;
  readAt: string | null;
}
export interface ClientChatUnreadSummary {
  count: number;
  oldestUnreadAt: string | null;
  latestUnreadMessageId: string | null;
}
export interface ClientChatPresenceSession {
  id: string; userId: string; activeAt: string; lastHeartbeatAt: string; endedAt: string | null;
}
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
  listDirectConversations(): Promise<ServiceResult<ClientDirectConversationPreview[]>>;
  getAssignedConversation(channelSlug?: string, conversationId?: string): Promise<ServiceResult<ClientChatData | null>>;
  getConversationForCall(callId: string): Promise<ServiceResult<ClientChatData | null>>;
  getUnreadSummary(conversationId: string): Promise<ServiceResult<ClientChatUnreadSummary>>;
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
export interface ReadyChatImageInitialization extends ReadyChatImageUpload {
  status: "ready";
  attachmentId: string;
}
export type ChatImageInitialization = ChatImageUploadAuthorization | ReadyChatImageInitialization;
export interface ChatImageService {
  initialize(input: {
    conversationId: string;
    clientUploadId: string;
    originalName: string;
    sourceMimeType: string;
    sourceByteSize: number;
    uploadSha256?: string;
  }): Promise<ChatImageInitialization>;
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
export interface EditMessageInput { messageId: string; body: string }
export interface DeleteMessageInput { messageId: string }
export interface SetReactionInput { messageId: string; emoji: string; active: boolean }
export interface ReportGifInput { messageId: string }
export type ChatMessageCommand =
  | ({ kind: "edit" } & EditMessageInput)
  | ({ kind: "delete" } & DeleteMessageInput)
  | ({ kind: "setReaction" } & SetReactionInput);
export interface MarkReadStateInput {
  conversationId: string;
  lastDeliveredMessageId: string | null;
  lastReadMessageId: string | null;
}
export interface RefreshMessagesInput { messageIds: string[] }
export interface ConversationInput { conversationId: string }
export interface LoadOlderMessagesInput extends ConversationInput {
  cursor?: { createdAt: string; id: string } | null;
  limit?: number;
}
export interface BackfillMessagesInput extends ConversationInput {
  afterCreatedAt: string;
  afterMessageId: string;
  limit?: number;
}
export interface LoadNewestMessagesInput extends ConversationInput { limit?: number }
export type ChatOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; notice: string };

export interface ChatCommandService {
  sendMessage(input: SendMessageInput): Promise<ChatOperationResult<ClientChatMessage>>;
  executeMessageCommand(command: ChatMessageCommand): Promise<ChatOperationResult<ClientChatMessage>>;
  reportGif(input: ReportGifInput): Promise<ChatOperationResult<void>>;
  markReadState(input: MarkReadStateInput): Promise<ChatOperationResult<ClientChatReadState>>;
  refreshMessages(input: RefreshMessagesInput): Promise<ChatOperationResult<ClientChatMessage[]>>;
  refreshConversation(input: ConversationInput): Promise<ChatOperationResult<{
    messages: ClientChatMessage[];
    readStates: ClientChatReadState[];
  }>>;
  loadOlderMessages(input: LoadOlderMessagesInput): Promise<ChatOperationResult<{
    messages: ClientChatMessage[];
    hasMoreOlder: boolean;
  }>>;
  backfillMessages(input: BackfillMessagesInput): Promise<ChatOperationResult<{
    messages: ClientChatMessage[];
    needsReset: boolean;
  }>>;
  loadNewestMessages(input: LoadNewestMessagesInput): Promise<ChatOperationResult<{
    messages: ClientChatMessage[];
    readStates: ClientChatReadState[];
    hasMoreOlder: boolean;
    oldestCursor: { createdAt: string; id: string } | null;
  }>>;
}

export interface ConversationTypingController {
  sendTyping(typing: boolean): void;
  unsubscribe(): void;
}
export interface ChatRealtimeService {
  subscribeToMessages(conversationId: string, onMessage: (message: ClientChatMessage) => void, onReconnected?: () => void, onDisconnected?: () => void): () => void;
  subscribeToReadStates(conversationId: string, onReadState: (state: ClientChatReadState) => void, onReconnected?: () => void): () => void;
  subscribeToReactionChanges(conversationId: string, onReactionChange: (messageId: string) => void, onReconnected?: () => void): () => void;
  subscribeToTyping(conversationId: string, currentUserId: string, onChange: (typing: boolean) => void): ConversationTypingController;
}
