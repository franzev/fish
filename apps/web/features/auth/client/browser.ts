import "client-only";

import { getBrowserServices } from "@/lib/services/runtime/browser";
import type {
  ServiceError,
  ServiceFailureReason,
  ServiceResult,
} from "@/lib/services";

export function getAuthFailureReason(
  error: ServiceError
): ServiceFailureReason | undefined {
  return error.details?.reason as ServiceFailureReason | undefined;
}

function browserAuth() {
  return getBrowserServices().auth;
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<ServiceResult<void>> {
  return browserAuth().signInWithPassword(input);
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<ServiceResult<{ userId: string | null; identityCount: number | null }>> {
  return browserAuth().signUpWithPassword(input);
}

export async function signInWithGoogle(): Promise<ServiceResult<void>> {
  return browserAuth().signInWithGoogle(
    `${window.location.origin}/auth/callback`
  );
}

export async function resendSignupEmail(email: string): Promise<ServiceResult<void>> {
  return browserAuth().resendSignupEmail(email);
}

export async function requestPasswordReset(
  email: string
): Promise<ServiceResult<void>> {
  return browserAuth().requestPasswordReset(email);
}

export async function updatePassword(
  password: string
): Promise<ServiceResult<void>> {
  return browserAuth().updatePassword(password);
}

export async function signOut(): Promise<ServiceResult<void>> {
  return browserAuth().signOut();
}
