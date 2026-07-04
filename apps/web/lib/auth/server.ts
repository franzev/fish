import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import type { CoachClientListItem, SupabaseServices } from "@/lib/services";
import { isUserRole, type UserRole } from "@fish/core/roles";
import { ServiceError } from "@/lib/services";
import { authRedirects } from "./redirects";

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
