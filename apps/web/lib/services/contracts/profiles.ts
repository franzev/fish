import type { ServiceResult } from "../errors";

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

export interface CoachAssignment { coachId: string }

export interface ClientProfile {
  id: string;
  goal: string;
  locale: string | null;
  timezone: string | null;
  level: string | null;
  themePref: string | null;
  reducedMotionPref: boolean | null;
  timeFormatPref: string | null;
  consented: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClientProfileUpdate = Partial<Pick<ClientProfile,
  | "goal" | "locale" | "timezone" | "themePref" | "reducedMotionPref"
  | "timeFormatPref" | "consented" | "consentedAt" | "consentVersion"
>>;

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
