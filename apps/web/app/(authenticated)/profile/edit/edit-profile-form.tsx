"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActionState, useEffect, useState } from "react";
import {
  updateProfileAction,
  type EditProfileState,
  type EditProfileValues,
} from "./actions";

/* The repo's first useActionState form (RESEARCH Pattern 2). Uncontrolled
   defaultValue, not value/onChange: useActionState only re-renders with a
   new `state.values` after a genuine server round-trip (a fresh redirect ->
   Server Component re-fetch, or a returned error state), so defaultValue
   correctly reflects post-submit values with no manual sync needed. This is
   also what gives D-07's "mid-edit refresh reverts to last-saved" property
   for free -- a hard refresh re-runs the Server Component above, which
   re-reads the DB, not any client-side cache. */
export function EditProfileForm({ initial }: { initial: EditProfileValues }) {
  const initialState: EditProfileState = { values: initial };
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState
  );

  // Locale/timezone are auto-filled from the browser, never a picker
  // (PROF-02) -- read once on mount and carried as hidden inputs so the
  // Server Action still receives them as FormData entries.
  const [locale, setLocale] = useState(initial.locale);
  const [timezone, setTimezone] = useState(initial.timezone);

  useEffect(() => {
    setLocale(navigator.language);
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <Card className="w-full max-w-[440px]">
      <h2 className="text-xl">Edit profile</h2>
      <form action={formAction} className="mt-6 space-y-1">
        <Input
          label="Display name"
          name="displayName"
          defaultValue={state.values.displayName}
          error={state.errors?.displayName?.[0]}
          required
        />
        <Input
          label="What are you working toward with your English?"
          name="goal"
          defaultValue={state.values.goal}
          hint="A quick note for your coach — optional."
        />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="timezone" value={timezone} />
        <div className="w-full">
          <span className="mb-2 block text-[15px] font-medium text-foreground">
            Locale &amp; timezone
          </span>
          <p className="text-[15px] text-body">
            {locale} · {timezone}
          </p>
          <p className="mt-1 text-[14px] text-muted">
            Detected from your browser.
          </p>
        </div>
        {state.notice && (
          <p className="flex items-center gap-1.5 text-[14px] text-notice">
            {state.notice}
          </p>
        )}
        <Button type="submit" variant="primary" fullWidth loading={pending}>
          Save
        </Button>
      </form>
    </Card>
  );
}
