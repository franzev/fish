import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import type { CoachClientListItem, SupabaseServices } from "@/lib/services";
import { isUserRole, type UserRole } from "@fish/core/roles";
import { ServiceError } from "@/lib/services";
import { authRedirects } from "./redirects";

export type ThemePref = "light" | "dark" | null;
export type TextSizePref = "default" | "large" | "larger" | null;

// The DB column is a CHECK-constrained `text`, not a Postgres enum, so the
// generated Row type is `string | null`. Narrow at this one server-side
// boundary rather than threading `string | null` through every client
// component that expects the literal union (defense-in-depth mirrors the
// zod schema's own narrowing job, just for reads instead of writes).
function toThemePref(value: string | null): ThemePref {
  return value === "light" || value === "dark" ? value : null;
}

function toTextSizePref(value: string | null): TextSizePref {
  return value === "large" || value === "larger" ? value : "default";
}

export interface CurrentProfile {
  userId: string;
  role: UserRole;
  displayName: string;
}

export interface ClientHomeData {
  role: UserRole;
  firstName: string;
  coachName: string | null;
}

export interface CoachHomeData {
  role: UserRole;
  clients: CoachClientListItem[];
}

export interface CoachClientDetail {
  /* Identity + goal/role-context + level ONLY (D-10) -- a11y prefs and
     consent are the client's personal settings, never selected into this
     coach-facing DTO. */
  displayName: string;
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

export interface ProfileData {
  role: UserRole;
  displayName: string;
  goal: string;
  locale: string | null;
  timezone: string | null;
  level: string | null;
  themePref: ThemePref;
  textSizePref: TextSizePref;
  reducedMotionPref: boolean | null;
  consented: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
  coachName: string | null;
}

async function getCurrentProfile(
  services: SupabaseServices
): Promise<CurrentProfile | null> {
  const userResult = await services.auth.getCurrentUser();
  if (!userResult.ok) {
    throw userResult.error;
  }

  if (!userResult.data) {
    return null;
  }

  const profileResult = await services.database.profiles.findById(
    userResult.data.id
  );
  if (!profileResult.ok) {
    throw profileResult.error;
  }

  if (!profileResult.data) {
    return null;
  }

  if (!isUserRole(profileResult.data.role)) {
    throw new ServiceError({
      code: "database",
      message: "Profile role is not recognized.",
      operation: "auth.getCurrentProfile",
      details: { role: profileResult.data.role },
    });
  }

  return {
    userId: userResult.data.id,
    role: profileResult.data.role,
    displayName: profileResult.data.display_name,
  };
}

export async function getRootRedirectPath(): Promise<string> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

  if (!profile) {
    return authRedirects.signedOut;
  }

  return profile.role === "coach"
    ? authRedirects.coachHome
    : authRedirects.clientHome;
}

export async function getAuthenticatedShellProfile(): Promise<CurrentProfile | null> {
  return getCurrentProfile(await createServerSupabaseServices());
}

export async function getClientHomeData(): Promise<ClientHomeData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

  if (!profile) {
    return null;
  }

  let coachName: string | null = null;
  const assignmentResult =
    await services.database.coachClients.findAssignmentForClient(profile.userId);
  if (!assignmentResult.ok) {
    throw assignmentResult.error;
  }

  if (assignmentResult.data) {
    const coachResult = await services.database.profiles.findDisplayNameById(
      assignmentResult.data.coach_id
    );
    if (!coachResult.ok) {
      throw coachResult.error;
    }
    coachName = coachResult.data?.display_name ?? null;
  }

  return {
    role: profile.role,
    firstName: profile.displayName.split(" ")[0] ?? "",
    coachName,
  };
}

/* Client-only data-access -- the caller (page) owns the role guard (D-03: a
   coach landing on /profile redirects away, same wrong-door discipline as
   every other page). This throws on any ServiceResult failure via the same
   idiom getClientHomeData/getCoachHomeData already use. */
export async function getProfileData(): Promise<ProfileData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

  if (!profile) {
    return null;
  }

  const clientProfileResult = await services.database.clientProfiles.findById(
    profile.userId
  );
  if (!clientProfileResult.ok) {
    throw clientProfileResult.error;
  }

  const clientProfile = clientProfileResult.data;

  let coachName: string | null = null;
  const assignmentResult =
    await services.database.coachClients.findAssignmentForClient(profile.userId);
  if (!assignmentResult.ok) {
    throw assignmentResult.error;
  }

  if (assignmentResult.data) {
    const coachResult = await services.database.profiles.findDisplayNameById(
      assignmentResult.data.coach_id
    );
    if (!coachResult.ok) {
      throw coachResult.error;
    }
    coachName = coachResult.data?.display_name ?? null;
  }

  return {
    role: profile.role,
    displayName: profile.displayName,
    goal: clientProfile?.goal ?? "",
    locale: clientProfile?.locale ?? null,
    timezone: clientProfile?.timezone ?? null,
    level: clientProfile?.level ?? null,
    themePref: toThemePref(clientProfile?.theme_pref ?? null),
    textSizePref: toTextSizePref(clientProfile?.text_size_pref ?? null),
    reducedMotionPref: clientProfile?.reduced_motion_pref ?? null,
    consented: clientProfile?.consented ?? false,
    consentedAt: clientProfile?.consented_at ?? null,
    consentVersion: clientProfile?.consent_version ?? null,
    coachName,
  };
}

export async function getCoachHomeData(): Promise<CoachHomeData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

  if (!profile) {
    return null;
  }

  const clientsResult = await services.database.coachClients.listAssignedClients();
  if (!clientsResult.ok) {
    throw clientsResult.error;
  }

  return {
    role: profile.role,
    clients: clientsResult.data,
  };
}

/* Postgres `uuid` columns reject a non-UUID id with error 22P02 (a THROW, not
   zero rows). Guarding the id here keeps the not-found contract uniform: a
   malformed id renders the SAME calm not-found as an unknown/unassigned one,
   so a coach cannot distinguish "invalid" from "not yours" (T-04-02). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Coach-only read of one assigned client (PROF-06/D-10/D-11). RLS
   (private.is_coach_of, reused verbatim from 0004/0007) is the sole
   authz boundary here -- no app-code id/coach_id filter substitutes for it.
   A null return means "not assigned or doesn't exist" and the caller (the
   page) renders the SAME calm not-found state for both cases -- there is
   no distinguishable error, so a coach cannot enumerate client UUIDs
   (T-04-02). */
export async function getCoachClientDetailData(
  clientId: string
): Promise<CoachClientDetailData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

  if (!profile) {
    return null;
  }

  // A malformed id never matches an existing uuid row; short-circuit to the
  // same calm not-found instead of letting Postgres 22P02 surface as a 500.
  if (!UUID_RE.test(clientId)) {
    return { role: profile.role, client: null };
  }

  const clientProfileResult =
    await services.database.clientProfiles.findByIdForCoach(clientId);
  if (!clientProfileResult.ok) {
    throw clientProfileResult.error;
  }

  if (!clientProfileResult.data) {
    return { role: profile.role, client: null };
  }

  // The client's display name lives on `profiles`, not `client_profiles`
  // (D-01). The 0004 "coach reads assigned clients" policy already grants
  // this read for an assigned coach; a genuinely unassigned coach's
  // client_profiles read above already returned null and we never reach
  // here, so this call is always for a client the coach may see.
  const nameResult = await services.database.profiles.findDisplayNameById(clientId);
  if (!nameResult.ok) {
    throw nameResult.error;
  }

  if (!nameResult.data) {
    return { role: profile.role, client: null };
  }

  return {
    role: profile.role,
    client: {
      displayName: nameResult.data.display_name,
      goal: clientProfileResult.data.goal ?? "",
      level: clientProfileResult.data.level ?? null,
    },
  };
}
