import {
  serviceFailure,
  serviceSuccess,
  type ServiceResult,
} from "@/lib/services/errors";
import { mapSupabaseError, safely } from "./shared";
import type { AuthSessionEvent, AuthService, AuthUser, EmailTokenKind } from "../contracts";
import type { AppSupabaseClient } from "./types";

function isAuthSessionMissingError(error: {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
}): boolean {
  return (
    error.name === "AuthSessionMissingError" ||
    error.message?.toLowerCase().includes("auth session missing") === true
  );
}

function isSignedOutAuthError(error: {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
}): boolean {
  const message = error.message?.toLowerCase() ?? "";

  return (
    isAuthSessionMissingError(error) ||
    error.code === "user_not_found" ||
    error.code === "refresh_token_not_found" ||
    error.code === "refresh_token_already_used" ||
    error.code === "session_not_found" ||
    error.code === "session_expired" ||
    (message.includes("invalid refresh token") &&
      (message.includes("refresh token not found") ||
        message.includes("already used")))
  );
}
const eventMap = {
  INITIAL_SESSION: "INITIAL_SESSION",
  SIGNED_IN: "SIGNED_IN",
  SIGNED_OUT: "SIGNED_OUT",
  TOKEN_REFRESHED: "TOKEN_REFRESHED",
  USER_UPDATED: "USER_UPDATED",
  PASSWORD_RECOVERY: "PASSWORD_RECOVERY",
  MFA_CHALLENGE_VERIFIED: "MFA_CHALLENGE_VERIFIED",
} as const;

function toAuthUser(user: { id: string; email?: string | null }): AuthUser {
  return { id: user.id, email: user.email ?? null };
}

export class SupabaseAuthServiceImpl implements AuthService {
  constructor(private readonly client: AppSupabaseClient) {}

  async getCurrentUser(): Promise<ServiceResult<AuthUser | null>> {
    return safely("auth.getCurrentUser", async () => {
      const { data, error } = await this.client.auth.getUser();
      if (error) {
        if (isSignedOutAuthError(error)) {
          return serviceSuccess(null);
        }

        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not read the current user.",
            operation: "auth.getCurrentUser",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(data.user ? toAuthUser(data.user) : null);
    });
  }

  async exchangeCode(code: string): Promise<ServiceResult<void>> {
    return safely("auth.exchangeCode", async () => {
      const { error } = await this.client.auth.exchangeCodeForSession(code);
      return error
        ? serviceFailure(mapSupabaseError(error, { code: "auth", fallbackMessage: "Could not complete sign in.", operation: "auth.exchangeCode", recoverable: true }))
        : serviceSuccess(undefined);
    });
  }

  async verifyEmailToken(tokenHash: string, kind: EmailTokenKind): Promise<ServiceResult<void>> {
    return safely("auth.verifyEmailToken", async () => {
      const type =
        kind === "magicLink"
          ? "magiclink"
          : kind === "emailChange"
            ? "email_change"
            : kind;
      const { error } = await this.client.auth.verifyOtp({ token_hash: tokenHash, type });
      return error
        ? serviceFailure(mapSupabaseError(error, { code: "auth", fallbackMessage: "Could not verify this link.", operation: "auth.verifyEmailToken", recoverable: true }))
        : serviceSuccess(undefined);
    });
  }

  subscribe(callback: (event: AuthSessionEvent, session: { user: AuthUser } | null) => void): () => void {
    const { data: { subscription } } = this.client.auth.onAuthStateChange((event, session) => {
      callback(eventMap[event], session ? { user: toAuthUser(session.user) } : null);
    });
    return () => subscription.unsubscribe();
  }

  async refreshSessionClaims(): Promise<ServiceResult<void>> {
    return safely("auth.refreshSessionClaims", async () => {
      const { error } = await this.client.auth.getClaims();
      if (error) {
        if (isSignedOutAuthError(error)) {
          return serviceSuccess(undefined);
        }

        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not refresh the session.",
            operation: "auth.refreshSessionClaims",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<ServiceResult<void>> {
    return safely("auth.signInWithPassword", async () => {
      const { error } = await this.client.auth.signInWithPassword(input);
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not sign in.",
            operation: "auth.signInWithPassword",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async signUpWithPassword(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<ServiceResult<{ userId: string | null; identityCount: number | null }>> {
    return safely("auth.signUpWithPassword", async () => {
      const { data, error } = await this.client.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.displayName } },
      });

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not create the account.",
            operation: "auth.signUpWithPassword",
            recoverable: true,
          })
        );
      }

      return serviceSuccess({
        userId: data.user?.id ?? null,
        identityCount: data.user?.identities?.length ?? null,
      });
    });
  }

  async signInWithGoogle(redirectTo: string): Promise<ServiceResult<void>> {
    return safely("auth.signInWithGoogle", async () => {
      const { error } = await this.client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not start Google sign-in.",
            operation: "auth.signInWithGoogle",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async resendSignupEmail(email: string): Promise<ServiceResult<void>> {
    return safely("auth.resendSignupEmail", async () => {
      const { error } = await this.client.auth.resend({ type: "signup", email });
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not resend the signup email.",
            operation: "auth.resendSignupEmail",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async requestPasswordReset(email: string): Promise<ServiceResult<void>> {
    return safely("auth.requestPasswordReset", async () => {
      const { error } = await this.client.auth.resetPasswordForEmail(email);
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not request a password reset.",
            operation: "auth.requestPasswordReset",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async updatePassword(password: string): Promise<ServiceResult<void>> {
    return safely("auth.updatePassword", async () => {
      const { error } = await this.client.auth.updateUser({ password });
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not update the password.",
            operation: "auth.updatePassword",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }

  async signOut(): Promise<ServiceResult<void>> {
    return safely("auth.signOut", async () => {
      const { error } = await this.client.auth.signOut();
      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "auth",
            fallbackMessage: "Could not sign out.",
            operation: "auth.signOut",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(undefined);
    });
  }
}
