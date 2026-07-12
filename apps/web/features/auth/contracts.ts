import type { ClientChatData, CoachClientListItem } from "@/lib/services";
import type { UserRole } from "@fish/core/roles";

export type ThemePref = "light" | "dark" | null;
export type TextSizePref = "default" | "large" | "larger" | null;
export type TimeFormatPref = "12h" | "24h" | null;

// The DB column is a CHECK-constrained `text`, not a Postgres enum, so the
// generated Row type is `string | null`. Narrow at this one server-side
// boundary rather than threading `string | null` through every client
// component that expects the literal union (defense-in-depth mirrors the
// zod schema's own narrowing job, just for reads instead of writes).
export function toThemePref(value: string | null): ThemePref {
  return value === "light" || value === "dark" ? value : null;
}

export function toTextSizePref(value: string | null): TextSizePref {
  return value === "large" || value === "larger" ? value : "default";
}

export function toTimeFormatPref(value: string | null): TimeFormatPref {
  return value === "12h" || value === "24h" ? value : null;
}

export interface CurrentProfile {
  userId: string;
  role: UserRole;
  displayName: string;
  avatarPath: string | null;
  avatarThumbnailPath: string | null;
}

export interface AuthenticatedShellProfile extends CurrentProfile {
  avatarUrl: string | null;
  themePref: ThemePref;
  textSizePref: TextSizePref;
  reducedMotionPref: boolean | null;
  timeFormatPref: TimeFormatPref;
}

export interface ClientHomeData {
  role: UserRole;
  firstName: string;
  coachId: string | null;
  coachName: string | null;
}

export interface CoachHomeData {
  role: UserRole;
  clients: CoachClientListItem[];
}

export interface CoachClientDetail {
  id: string;
  /* Identity + goal/role-context + level ONLY (D-10) -- a11y prefs and
     consent are the client's personal settings, never selected into this
     coach-facing DTO. */
  displayName: string;
  avatarUrl: string | null;
  goal: string;
  level: string | null;
}

export interface CoachClientDetailData {
  role: UserRole;
  // null means "not assigned or doesn't exist" (T-04-02) -- the page
  // renders the SAME calm not-found state for both, never a session
  // redirect, since role/session are already known to be valid here.
  client: CoachClientDetail | null;
}

export interface ChatPageData {
  role: UserRole;
  chat: ClientChatData | null;
}

export interface ProfileData {
  userId: string;
  role: UserRole;
  displayName: string;
  avatarUrl: string | null;
  hasAvatar: boolean;
  goal: string;
  locale: string | null;
  timezone: string | null;
  level: string | null;
  themePref: ThemePref;
  textSizePref: TextSizePref;
  reducedMotionPref: boolean | null;
  timeFormatPref: TimeFormatPref;
  consented: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
  coachName: string | null;
  coachId: string | null;
  coachAvatarUrl: string | null;
}
