"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActionState, useSyncExternalStore } from "react";
import {
  updateProfileAction,
  type EditProfileState,
  type EditProfileValues,
} from "@/features/profile/server/actions";

// Locale/timezone never change during a session, so the external store never
// emits -- subscribe is a no-op that returns an empty unsubscribe.
const subscribeNever = () => () => {};

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
  // (PROF-02) -- carried as hidden inputs so the Server Action still receives
  // them as FormData entries. useSyncExternalStore is React's sanctioned way
  // to read a browser-only value: the server snapshot uses the DB-stored value
  // and the client snapshot reads the live browser value, with no
  // setState-in-effect and no hydration mismatch warning.
  const locale = useSyncExternalStore(
    subscribeNever,
    () => navigator.language,
    () => initial.locale
  );
  const timezone = useSyncExternalStore(
    subscribeNever,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => initial.timezone
  );

  return (
    <Card className="w-full max-w-form">
      <h2 className="text-xl">Edit profile</h2>
      <form action={formAction} className="mt-lg space-y-2xs">
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
          <span className="mb-xs block text-ui font-medium text-foreground">
            Locale &amp; timezone
          </span>
          <p className="text-ui text-body">
            {locale} · {timezone}
          </p>
          <p className="mt-2xs text-ui-sm text-muted">
            Detected from your browser.
          </p>
        </div>
        {state.notice && (
          <p className="flex items-center gap-nudge text-ui-sm text-notice">
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
