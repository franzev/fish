import "server-only";

import { getServerServices } from "@/lib/services/runtime/server";
import { getCurrentProfile } from "@/features/auth/server/page-data";
import type { CoachClientDetailData, CoachHomeData } from "@/features/auth/contracts";
import type { AppServices } from "@/lib/services";

export async function getCoachHomeData(
  injected?: AppServices
): Promise<CoachHomeData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile({
    auth: services.auth,
    profiles: services.database.profiles,
  });

  if (!profile) {
    return null;
  }

  const clientsResult = await services.database.coachClients.listAssignedClients();
  if (!clientsResult.ok) {
    throw clientsResult.error;
  }

  const avatarItems = services.avatars
    ? await services.avatars.resolveUrls(clientsResult.data.map((client) => client.id))
    : [];
  const avatarUrls = new Map(avatarItems.map((item) => [item.profileId, item.url]));

  return {
    role: profile.role,
    clients: clientsResult.data.map((client) => ({
      ...client,
      avatarUrl: avatarUrls.get(client.id) ?? null,
    })),
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
  clientId: string,
  injected?: AppServices
): Promise<CoachClientDetailData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile({
    auth: services.auth,
    profiles: services.database.profiles,
  });

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

  const avatarUrl = services.avatars
    ? (await services.avatars.resolveUrls([clientId]))[0]?.url ?? null
    : null;

  return {
    role: profile.role,
    client: {
      id: clientId,
      displayName: nameResult.data.displayName,
      avatarUrl,
      goal: clientProfileResult.data.goal ?? "",
      level: clientProfileResult.data.level ?? null,
    },
  };
}
