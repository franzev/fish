import type { ServiceResult } from "../errors";

export interface AuthUser {
  id: string;
  email?: string | null;
}

export type AuthSessionEvent =
  | "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED"
  | "USER_UPDATED" | "PASSWORD_RECOVERY" | "MFA_CHALLENGE_VERIFIED";

export interface AuthSession {
  user: AuthUser;
}

export type EmailTokenKind =
  | "email"
  | "signup"
  | "invite"
  | "magicLink"
  | "recovery"
  | "emailChange";

export interface AuthService {
  getCurrentUser(): Promise<ServiceResult<AuthUser | null>>;
  exchangeCode(code: string): Promise<ServiceResult<void>>;
  verifyEmailToken(tokenHash: string, kind: EmailTokenKind): Promise<ServiceResult<void>>;
  subscribe(callback: (event: AuthSessionEvent, session: AuthSession | null) => void): () => void;
  refreshSessionClaims(): Promise<ServiceResult<void>>;
  signInWithPassword(input: { email: string; password: string }): Promise<ServiceResult<void>>;
  signUpWithPassword(input: { email: string; password: string; displayName: string }): Promise<ServiceResult<{ userId: string | null; identityCount: number | null }>>;
  signInWithGoogle(redirectTo: string): Promise<ServiceResult<void>>;
  resendSignupEmail(email: string): Promise<ServiceResult<void>>;
  requestPasswordReset(email: string): Promise<ServiceResult<void>>;
  updatePassword(password: string): Promise<ServiceResult<void>>;
  signOut(): Promise<ServiceResult<void>>;
}
