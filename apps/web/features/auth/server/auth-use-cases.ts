import type {
  AuthService,
  EmailTokenKind,
  ProfileRepository,
} from "@/lib/services";
import { authRedirects } from "../redirects";

export interface AuthNavigationDependencies {
  auth: Pick<AuthService, "exchangeCode" | "getCurrentUser">;
  profiles: Pick<ProfileRepository, "findRoleById">;
}

export async function getSignedInDestination(
  dependencies: AuthNavigationDependencies
): Promise<string | null> {
  const userResult = await dependencies.auth.getCurrentUser();
  if (!userResult.ok || !userResult.data) return null;

  const profileResult = await dependencies.profiles.findRoleById(
    userResult.data.id
  );
  return profileResult.ok && profileResult.data?.role === "coach"
    ? authRedirects.coachHome
    : authRedirects.clientHome;
}

export async function completeOAuthSignIn(
  code: string,
  dependencies: AuthNavigationDependencies
): Promise<string> {
  const exchange = await dependencies.auth.exchangeCode(code);
  if (!exchange.ok) return authRedirects.signedOut;

  return (
    (await getSignedInDestination(dependencies)) ?? authRedirects.clientHome
  );
}

export async function verifyEmailLink(
  tokenHash: string,
  kind: EmailTokenKind,
  auth: Pick<AuthService, "verifyEmailToken">
): Promise<boolean> {
  return (await auth.verifyEmailToken(tokenHash, kind)).ok;
}
