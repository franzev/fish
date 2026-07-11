"use server";

import "server-only";

import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import type { ClientProfileSafeFields } from "@/lib/services";
import { editProfileSchema } from "@/lib/validation/profile";
import { redirect } from "next/navigation";

export interface EditProfileValues {
  displayName: string;
  goal: string;
  locale: string;
  timezone: string;
}

export interface EditProfileState {
  errors?: Record<string, string[]>;
  values: EditProfileValues;
  notice?: string;
}

/* The repo's first Server Action (D-07 discipline-setting pattern, RESEARCH
   Pattern 2). Re-verifies getUser() INSIDE the action -- Server Actions are
   directly POST-reachable, so the page's own wrong-door guard is not
   sufficient (T-04-05). zod-validates, then splits the write: display name
   goes to profiles (existing own-profile RLS policy), the rest to
   client_profiles (0007's safe-column grant) -- routed through the
   repository/ServiceResult layer, never a raw services.client.from(...)
   call, so error handling stays consistent with the rest of the app. The
   coach-owned protected field is deliberately never named here -- the DB
   grant + trigger (0007) are the load-bearing freeze; the zod schema (which
   has no such key) is the defense-in-depth layer above it. */
export async function updateProfileAction(
  prevState: EditProfileState,
  formData: FormData
): Promise<EditProfileState> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  const rawValues: EditProfileValues = {
    displayName: String(formData.get("displayName") ?? ""),
    goal: String(formData.get("goal") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  };

  if (!userResult.ok || !userResult.data) {
    return {
      values: rawValues,
      notice: "Your session expired. Sign in again to save.",
    };
  }

  const parsed = editProfileSchema.safeParse(rawValues);
  if (!parsed.success) {
    // D-07: failed validation returns the SAME typed values -- nothing is
    // cleared.
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: rawValues,
    };
  }

  const userId = userResult.data.id;

  const displayNameResult = await services.database.profiles.updateDisplayName(
    userId,
    parsed.data.displayName
  );

  const safeFields: ClientProfileSafeFields = {
    goal: parsed.data.goal,
    locale: parsed.data.locale,
    timezone: parsed.data.timezone,
  };
  const clientProfileResult = await services.database.clientProfiles.updateSafeFields(
    userId,
    safeFields
  );

  if (!displayNameResult.ok || !clientProfileResult.ok) {
    // Calm, soft-notice tone -- never scolds (AGENTS.md rule 6).
    return {
      values: rawValues,
      notice: "Couldn't save just now. Your text is still here — try again?",
    };
  }

  redirect("/profile");
}

/* Combined consent (D-12): a calm "your agreement" affordance recording the
   current version, routed through the same safe-write path as the other
   fields. Kept as its own action (no form fields to validate beyond a fixed
   version string) rather than folded into updateProfileAction's zod
   schema, since it's acknowledged independently of editing display
   name/goal. */
export async function acceptConsentAction(version: string): Promise<void> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return;
  }

  const fields: ClientProfileSafeFields = {
    consented: true,
    consented_at: new Date().toISOString(),
    consent_version: version,
  };

  await services.database.clientProfiles.updateSafeFields(
    userResult.data.id,
    fields
  );
}

export interface UpdatePrefsInput {
  themePref: "light" | "dark" | null;
  textSizePref: "default" | "large" | "larger" | null;
  reducedMotionPref: boolean | null;
  timeFormatPref: "12h" | "24h" | null;
}

/* A11y prefs persist independently of the display-name/goal edit form (D-14:
   apply instantly, then persist so they rehydrate cross-device) -- called
   directly from the "use client" a11y-prefs settings row, not through
   useActionState (there's no form submission here, just an on-change
   write-through). Re-verifies getUser() the same way updateProfileAction
   does (T-04-05): Server Actions are directly POST-reachable. */
export async function updatePrefsAction(input: UpdatePrefsInput): Promise<void> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return;
  }

  const fields: ClientProfileSafeFields = {
    theme_pref: input.themePref,
    text_size_pref: input.textSizePref,
    reduced_motion_pref: input.reducedMotionPref,
    time_format_pref: input.timeFormatPref,
  };

  await services.database.clientProfiles.updateSafeFields(
    userResult.data.id,
    fields
  );
}
