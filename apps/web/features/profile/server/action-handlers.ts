import type {
  AuthService,
  ClientProfileRepository,
  ClientProfileUpdate,
  ProfileRepository,
} from "@/lib/services";
import { editProfileSchema } from "../validation";

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

export interface UpdatePrefsInput {
  themePref: "light" | "dark" | null;
  textSizePref: "default" | "large" | "larger" | null;
  reducedMotionPref: boolean | null;
  timeFormatPref: "12h" | "24h" | null;
}

export interface ProfileActionDependencies {
  auth: Pick<AuthService, "getCurrentUser">;
  profiles: Pick<ProfileRepository, "updateDisplayName">;
  clientProfiles: Pick<ClientProfileRepository, "updateSafeFields">;
  redirect(path: string): never;
}

export function createProfileActionHandlers(
  dependencies: ProfileActionDependencies
) {
  return {
    async updateProfile(
      _previousState: EditProfileState,
      formData: FormData
    ): Promise<EditProfileState> {
      const rawValues: EditProfileValues = {
        displayName: String(formData.get("displayName") ?? ""),
        goal: String(formData.get("goal") ?? ""),
        locale: String(formData.get("locale") ?? ""),
        timezone: String(formData.get("timezone") ?? ""),
      };
      const userResult = await dependencies.auth.getCurrentUser();
      if (!userResult.ok || !userResult.data) {
        return {
          values: rawValues,
          notice: "Your session expired. Sign in again to save.",
        };
      }

      const parsed = editProfileSchema.safeParse(rawValues);
      if (!parsed.success) {
        return {
          errors: parsed.error.flatten().fieldErrors,
          values: rawValues,
        };
      }

      const displayNameResult =
        await dependencies.profiles.updateDisplayName(
          userResult.data.id,
          parsed.data.displayName
        );
      const clientProfileResult =
        await dependencies.clientProfiles.updateSafeFields(
          userResult.data.id,
          {
            goal: parsed.data.goal,
            locale: parsed.data.locale,
            timezone: parsed.data.timezone,
          }
        );

      if (!displayNameResult.ok || !clientProfileResult.ok) {
        return {
          values: rawValues,
          notice:
            "Couldn't save just now. Your text is still here — try again?",
        };
      }
      return dependencies.redirect("/profile");
    },

    async acceptConsent(version: string): Promise<void> {
      const userResult = await dependencies.auth.getCurrentUser();
      if (!userResult.ok || !userResult.data) return;

      const fields: ClientProfileUpdate = {
        consented: true,
        consentedAt: new Date().toISOString(),
        consentVersion: version,
      };
      await dependencies.clientProfiles.updateSafeFields(
        userResult.data.id,
        fields
      );
    },

    async updatePrefs(input: UpdatePrefsInput): Promise<void> {
      const userResult = await dependencies.auth.getCurrentUser();
      if (!userResult.ok || !userResult.data) return;

      await dependencies.clientProfiles.updateSafeFields(
        userResult.data.id,
        {
          themePref: input.themePref,
          textSizePref: input.textSizePref,
          reducedMotionPref: input.reducedMotionPref,
          timeFormatPref: input.timeFormatPref,
        }
      );
    },
  };
}
