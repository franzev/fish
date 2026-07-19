import type { CommandResult } from "./command-results";

export type ClientCallStatus =
  | "ringing" | "connecting" | "active" | "ended" | "rejected" | "cancelled" | "missed" | "failed";

export interface ClientCall {
  id: string;
  lessonSlotId: string | null;
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

export interface CallConnection { serverUrl: string; participantToken: string }

export type CallCommandResult = CommandResult<{ call: ClientCall; connection?: CallConnection }>;
export type MediaCheckCommandResult = CommandResult<{ connection: CallConnection }>;

export interface CallCommandService {
  initiate(input: { recipientId: string; kind: "audio" | "video"; clientRequestId: string }): Promise<CallCommandResult>;
  initiateLesson(input: { lessonId: string; clientRequestId: string }): Promise<CallCommandResult>;
  checkMedia(lessonId: string): Promise<MediaCheckCommandResult>;
  accept(callId: string): Promise<CallCommandResult>;
  reject(callId: string): Promise<CallCommandResult>;
  cancel(callId: string): Promise<CallCommandResult>;
  end(callId: string): Promise<CallCommandResult>;
  join(callId: string): Promise<CallCommandResult>;
}

export interface CallRealtimeEvent { callId: string; status: ClientCallStatus; occurredAt: string }
export interface CallRealtimeService {
  subscribe(userId: string, onEvent: (event: CallRealtimeEvent) => void, onRecovery?: () => void): () => void;
  findCurrentCall(userId: string): Promise<{ call: ClientCall; counterpartName: string } | null>;
  findCall(callId: string, userId: string): Promise<{ call: ClientCall; counterpartName: string } | null>;
}
