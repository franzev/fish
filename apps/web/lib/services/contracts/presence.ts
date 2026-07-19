import type {
  PresenceDurationSeconds,
  PresencePreference,
  PresencePreferenceSetting,
  PresenceSnapshot,
} from "@fish/core/presence";
import type { ServiceResult } from "../errors";
import type { CommandResult } from "./command-results";

export type {
  EffectivePresenceStatus,
  PresenceDurationSeconds,
  PresencePreference,
  PresencePreferenceSetting,
  PresenceSnapshot,
} from "@fish/core/presence";

export interface PresenceRepository {
  listVisible(): Promise<ServiceResult<PresenceSnapshot[]>>;
  getOwnPreference(): Promise<ServiceResult<PresencePreferenceSetting>>;
}

export type PresenceCommandResult = CommandResult<{
  snapshot: PresenceSnapshot;
  setting: PresencePreferenceSetting;
}>;

export interface PresenceCommandService {
  setMode(mode: PresencePreference, durationSeconds?: PresenceDurationSeconds | null): Promise<PresenceCommandResult>;
}

export interface AppPresenceSessionController {
  markActive(): void;
  stop(): void;
}

export interface PresenceRealtimeService {
  subscribe(
    userId: string,
    subjectIds: string[],
    onSnapshot: (snapshot: PresenceSnapshot) => void,
    onPreference: (setting: PresencePreferenceSetting, revision: number) => void,
    onRecovery?: () => void,
    onStatus?: (status: "connected" | "disconnected") => void
  ): () => void;
  startSession(onSnapshot?: (snapshot: PresenceSnapshot) => void, onError?: () => void): AppPresenceSessionController;
}
