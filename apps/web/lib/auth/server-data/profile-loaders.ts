import "server-only";

import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import type { SupabaseServices } from "@/lib/services";
import { ServiceError } from "@/lib/services";
import { authRedirects } from "@/lib/auth/redirects";
import { isUserRole } from "@fish/core/roles";
import {
  toTextSizePref,
  toThemePref,
  toTimeFormatPref,
  type AuthenticatedShellProfile,
  type ClientHomeData,
  type CurrentProfile,
  type ProfileData,
} from "./types";

export async function getCurrentProfile(
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

export async function getAuthenticatedShellProfile(): Promise<AuthenticatedShellProfile | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

  if (!profile) {
    return null;
  }

  if (profile.role !== "client") {
    return {
      ...profile,
      themePref: null,
      textSizePref: "default",
      reducedMotionPref: null,
      timeFormatPref: null,
    };
  }

  const clientProfileResult = await services.database.clientProfiles.findById(
    profile.userId
  );
  if (!clientProfileResult.ok) {
    throw clientProfileResult.error;
  }

  return {
    ...profile,
    themePref: toThemePref(clientProfileResult.data?.theme_pref ?? null),
    textSizePref: toTextSizePref(clientProfileResult.data?.text_size_pref ?? null),
    reducedMotionPref: clientProfileResult.data?.reduced_motion_pref ?? null,
    timeFormatPref: toTimeFormatPref(
      clientProfileResult.data?.time_format_pref ?? null
    ),
  };
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
    timeFormatPref: toTimeFormatPref(clientProfile?.time_format_pref ?? null),
    consented: clientProfile?.consented ?? false,
    consentedAt: clientProfile?.consented_at ?? null,
    consentVersion: clientProfile?.consent_version ?? null,
    coachName,
  };
}
