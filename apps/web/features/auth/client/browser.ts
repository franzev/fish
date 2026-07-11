import "client-only";

import { getBrowserServices } from "@/lib/services/runtime/browser";
import type { ServiceError, ServiceResult } from "@/lib/services";

export function getAuthErrorCode(error: ServiceError): string | undefined {
  const code = error.details?.supabaseCode;
  return typeof code === "string" ? code : undefined;
}

export function getAuthErrorName(error: ServiceError): string | undefined {
  const name = error.details?.supabaseName;
  return typeof name === "string" ? name : undefined;
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
