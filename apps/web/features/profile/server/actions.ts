"use server";

import { getServerServices } from "@/lib/services/runtime/server";
import { redirect } from "next/navigation";
import {
  createProfileActionHandlers,
  type EditProfileState,
  type UpdatePrefsInput,
} from "./action-handlers";

export type {
  EditProfileState,
  EditProfileValues,
  UpdatePrefsInput,
} from "./action-handlers";

async function handlers() {
  const services = await getServerServices();
  return createProfileActionHandlers({
    auth: services.auth,
    profiles: services.database.profiles,
    clientProfiles: services.database.clientProfiles,
    redirect,
  });
}

export async function updateProfileAction(
  previousState: EditProfileState,
  formData: FormData
): Promise<EditProfileState> {
  return (await handlers()).updateProfile(previousState, formData);
}

export async function acceptConsentAction(version: string): Promise<void> {
  return (await handlers()).acceptConsent(version);
}

export async function updatePrefsAction(
  input: UpdatePrefsInput
): Promise<void> {
  return (await handlers()).updatePrefs(input);
}

export async function adoptThemePreferenceAction(
  themePref: unknown
): Promise<boolean> {
  if (themePref !== "light" && themePref !== "dark") return false;
  return (await handlers()).adoptThemePref(themePref);
}
