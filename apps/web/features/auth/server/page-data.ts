import "server-only";

import { getServerServices } from "@/lib/services/runtime/server";
import type {
  AppServices,
  AuthService,
  ProfileRepository,
} from "@/lib/services";
import { ServiceError } from "@/lib/services";
import { authRedirects } from "../redirects";
import { isUserRole } from "@fish/core/roles";
import {
  toTextSizePref,
  toThemePref,
  toTimeFormatPref,
  type AuthenticatedShellProfile,
  type ClientHomeData,
  type CurrentProfile,
  type ProfileData,
} from "../contracts";
import { cache } from "react";

export async function getCurrentProfile(
  dependencies: {
    auth: AuthService;
    profiles: ProfileRepository;
  }
): Promise<CurrentProfile | null> {
  const userResult = await dependencies.auth.getCurrentUser();
  if (!userResult.ok) {
    throw userResult.error;
  }

  if (!userResult.data) {
    return null;
  }

  const profileResult = await dependencies.profiles.findById(
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
    displayName: profileResult.data.displayName,
  };
}

function currentProfileDependencies(services: AppServices) {
  return { auth: services.auth, profiles: services.database.profiles };
}

export async function getRootRedirectPath(
  injected?: AppServices
): Promise<string> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(currentProfileDependencies(services));

  if (!profile) {
    return authRedirects.signedOut;
  }

  return profile.role === "coach"
    ? authRedirects.coachHome
    : authRedirects.clientHome;
}

async function getAuthenticatedShellProfileUncached(
  injected?: AppServices
): Promise<AuthenticatedShellProfile | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(currentProfileDependencies(services));

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
    themePref: toThemePref(clientProfileResult.data?.themePref ?? null),
    textSizePref: toTextSizePref(clientProfileResult.data?.textSizePref ?? null),
    reducedMotionPref: clientProfileResult.data?.reducedMotionPref ?? null,
    timeFormatPref: toTimeFormatPref(
      clientProfileResult.data?.timeFormatPref ?? null
    ),
  };
}

const getCachedAuthenticatedShellProfile = cache(() =>
  getAuthenticatedShellProfileUncached()
);

export function getAuthenticatedShellProfile(
  injected?: AppServices
): Promise<AuthenticatedShellProfile | null> {
  return injected
    ? getAuthenticatedShellProfileUncached(injected)
    : getCachedAuthenticatedShellProfile();
}

export async function getClientHomeData(
  injected?: AppServices
): Promise<ClientHomeData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(currentProfileDependencies(services));

  if (!profile) {
    return null;
  }

  let coachId: string | null = null;
  let coachName: string | null = null;
  const assignmentResult =
    await services.database.coachClients.findAssignmentForClient(profile.userId);
  if (!assignmentResult.ok) {
    throw assignmentResult.error;
  }

  if (assignmentResult.data) {
    coachId = assignmentResult.data.coachId;
    const coachResult = await services.database.profiles.findDisplayNameById(
      assignmentResult.data.coachId
    );
    if (!coachResult.ok) {
      throw coachResult.error;
    }
    coachName = coachResult.data?.displayName ?? null;
  }

  return {
    role: profile.role,
    firstName: profile.displayName.split(" ")[0] ?? "",
    coachId,
    coachName,
  };
}

/* Client-only data-access -- the caller (page) owns the role guard (D-03: a
   coach landing on /profile redirects away, same wrong-door discipline as
   every other page). This throws on any ServiceResult failure via the same
   idiom getClientHomeData/getCoachHomeData already use. */
export async function getProfileData(
  injected?: AppServices
): Promise<ProfileData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(currentProfileDependencies(services));

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
      assignmentResult.data.coachId
    );
    if (!coachResult.ok) {
      throw coachResult.error;
    }
    coachName = coachResult.data?.displayName ?? null;
  }

  return {
    role: profile.role,
    displayName: profile.displayName,
    goal: clientProfile?.goal ?? "",
    locale: clientProfile?.locale ?? null,
    timezone: clientProfile?.timezone ?? null,
    level: clientProfile?.level ?? null,
    themePref: toThemePref(clientProfile?.themePref ?? null),
    textSizePref: toTextSizePref(clientProfile?.textSizePref ?? null),
    reducedMotionPref: clientProfile?.reducedMotionPref ?? null,
    timeFormatPref: toTimeFormatPref(clientProfile?.timeFormatPref ?? null),
    consented: clientProfile?.consented ?? false,
    consentedAt: clientProfile?.consentedAt ?? null,
    consentVersion: clientProfile?.consentVersion ?? null,
    coachName,
  };
}
