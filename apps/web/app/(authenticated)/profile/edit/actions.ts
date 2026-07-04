"use server";

import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import type { ClientProfileSafeFields } from "@/lib/services";

export interface UpdatePrefsInput {
  themePref: "light" | "dark" | null;
  textSizePref: "default" | "large" | "larger" | null;
  reducedMotionPref: boolean | null;
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
  };

  await services.database.clientProfiles.updateSafeFields(
    userResult.data.id,
    fields
  );
}
