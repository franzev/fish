---
phase: 04-client-profiles
reviewed: 2026-07-05T01:10:18Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - apps/web/app/(authenticated)/coach/clients/[id]/page.tsx
  - apps/web/app/(authenticated)/home/page.tsx
  - apps/web/app/(authenticated)/profile/edit/actions.test.ts
  - apps/web/app/(authenticated)/profile/edit/actions.ts
  - apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx
  - apps/web/app/(authenticated)/profile/edit/page.tsx
  - apps/web/app/(authenticated)/profile/page.tsx
  - apps/web/app/globals.css
  - apps/web/components/coach/client-list.tsx
  - apps/web/components/profile/a11y-prefs.test.tsx
  - apps/web/components/profile/a11y-prefs.tsx
  - apps/web/components/profile/coach-card.tsx
  - apps/web/components/profile/consent-row.tsx
  - apps/web/components/profile/settings-row.tsx
  - apps/web/lib/auth/server.ts
  - apps/web/lib/prefs/apply-prefs.ts
  - apps/web/lib/services/supabase/core.ts
  - apps/web/lib/services/supabase/types.ts
  - apps/web/lib/validation/profile.test.ts
  - apps/web/lib/validation/profile.ts
  - apps/web/package.json
  - packages/supabase/src/database.generated.ts
  - packages/supabase/src/database.types.ts
  - scripts/seed.ts
  - scripts/verify-rls.ts
  - supabase/migrations/0007_client_profiles.sql
findings:
  critical: 3
  warning: 4
  info: 0
  total: 7
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-05T01:10:18Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the requested client profile UI, Server Actions, Supabase service layer, generated contracts, seed/RLS scripts, and `0007_client_profiles.sql` against the FISH product rules and RLS/auth boundary requirements. The main risks are at the database boundary: the coach RLS policy exposes private client settings, the migration does not backfill existing client rows, and consent can be acknowledged optimistically without a verified write.

## Critical Issues

### CR-01: Coach RLS grants full client_profile rows, leaking private settings

**Classification:** BLOCKER
**File:** `supabase/migrations/0007_client_profiles.sql:34`
**Issue:** `grant select on public.client_profiles to authenticated` plus the coach policy at lines 56-60 lets any assigned coach query every column in the assigned client's `client_profiles` row through the Supabase client, including `theme_pref`, `text_size_pref`, `reduced_motion_pref`, `consented`, `consented_at`, and `consent_version`. The UI DTO omits these fields, but RLS is the real API boundary here; `findByIdForCoach()` also selects `*` at `apps/web/lib/services/supabase/core.ts:345`, and `scripts/verify-rls.ts:271` treats `select("*")` as the expected coach proof. This violates the phase comment that a11y prefs and consent are personal settings never shown to coaches.
**Fix:** Do not use the mixed private/public table as a direct coach-readable surface. Split private settings/consent into a separate client-only table, or expose a coach-safe relation/RPC containing only `id`, `goal`, and `level`, then remove the coach `select` policy on the private table. Also update the repository and RLS verifier to select the safe surface only.

```sql
-- Example direction: keep private columns off the coach-readable table.
create table public.client_profile_private_settings (
  id uuid primary key references public.profiles (id) on delete cascade,
  theme_pref text check (theme_pref in ('light', 'dark')),
  text_size_pref text check (text_size_pref in ('default', 'large', 'larger')),
  reduced_motion_pref boolean,
  consented boolean not null default false,
  consented_at timestamptz,
  consent_version text
);

-- Coach policy should only reach a safe relation/table that has goal + level.
```

### CR-02: Existing client profiles are not backfilled, and zero-row updates are reported as success

**Classification:** BLOCKER
**File:** `supabase/migrations/0007_client_profiles.sql:107`
**Issue:** The migration only adds an `after insert on public.profiles` trigger for future profiles. Existing client rows created by earlier migrations never receive `client_profiles` rows. The write path then calls `.update(fields).eq("id", id)` in `apps/web/lib/services/supabase/core.ts:370-373`; PostgREST updates that match zero rows do not produce an error, so `updateProfileAction`, preference updates, and consent can all return success while dropping the client_profile fields on the floor.
**Fix:** Backfill existing clients inside the migration, and make the repository fail when an update affects no row.

```sql
insert into public.client_profiles (id)
select id
from public.profiles
where role = 'client'
on conflict (id) do nothing;
```

```ts
const { data, error } = await this.client
  .from("client_profiles")
  .update(fields)
  .eq("id", id)
  .select("id")
  .maybeSingle();

if (error) return serviceFailure(...);
if (!data) {
  return serviceFailure(new ServiceError({
    code: "database",
    message: "Could not save the profile details.",
    operation: "clientProfiles.updateSafeFields",
    recoverable: true,
  }));
}
```

### CR-03: Consent acknowledgement is client-forgeable and optimistic

**Classification:** BLOCKER
**File:** `apps/web/app/(authenticated)/profile/edit/actions.ts:97`
**Issue:** `acceptConsentAction(version: string)` trusts a client-supplied version and writes it directly at lines 105-113. A direct Server Action POST can claim an arbitrary consent version. The component then calls `setAccepted(true)` immediately after `await acceptConsentAction(...)` at `apps/web/components/profile/consent-row.tsx:39-40`, even though the action returns silently on no session and ignores `updateSafeFields()` failures. The UI can say "Accepted" when no durable consent record exists.
**Fix:** Own the current consent version on the server, return a typed result, and only set local accepted state after a verified successful write.

```ts
const CURRENT_CONSENT_VERSION = "2026-07";

export async function acceptConsentAction(): Promise<{ ok: boolean }> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();
  if (!userResult.ok || !userResult.data) return { ok: false };

  const result = await services.database.clientProfiles.updateSafeFields(
    userResult.data.id,
    {
      consented: true,
      consented_at: new Date().toISOString(),
      consent_version: CURRENT_CONSENT_VERSION,
    }
  );
  return { ok: result.ok };
}
```

## Warnings

### WR-01: "System" preference selections do not persist

**Classification:** WARNING
**File:** `apps/web/components/profile/a11y-prefs.tsx:110`
**Issue:** `persist()` uses nullish coalescing: `next.themePref ?? theme` and `next.reducedMotionPref ?? reducedMotion`. When the user changes Appearance or Reduced motion back to "System", the next value is `null`, so the persisted payload falls back to the previous non-null state. The UI applies the system setting locally, but the saved DB value remains `light`/`dark` or `true`/`false`, so reload or another device reverts it.
**Fix:** Check key presence instead of nullish value.

```ts
function persist(next: Partial<UpdatePrefsInput>) {
  void updatePrefsAction({
    themePref: Object.prototype.hasOwnProperty.call(next, "themePref")
      ? next.themePref ?? null
      : theme,
    textSizePref: Object.prototype.hasOwnProperty.call(next, "textSizePref")
      ? next.textSizePref ?? null
      : textSize,
    reducedMotionPref: Object.prototype.hasOwnProperty.call(
      next,
      "reducedMotionPref"
    )
      ? next.reducedMotionPref ?? null
      : reducedMotion,
  });
}
```

### WR-02: Preference Server Action has no runtime validation or failure signal

**Classification:** WARNING
**File:** `apps/web/app/(authenticated)/profile/edit/actions.ts:129`
**Issue:** `updatePrefsAction()` accepts `UpdatePrefsInput` as if TypeScript protected the Server Action boundary. It is directly POST-reachable and writes unvalidated `themePref` and `textSizePref` values to DB-constrained text columns at lines 137-145. Invalid values become database errors that are ignored because the action returns `void`, leaving the UI optimistic and unsynchronized.
**Fix:** Parse the action input with zod (or literal guards), return a result, and have the client revert or show a calm notice on failure.

```ts
const prefsSchema = z.object({
  themePref: z.enum(["light", "dark"]).nullable(),
  textSizePref: z.enum(["default", "large", "larger"]).nullable(),
  reducedMotionPref: z.boolean().nullable(),
});
```

### WR-03: Preference segmented buttons are below the required 56px tap target

**Classification:** WARNING
**File:** `apps/web/components/profile/a11y-prefs.tsx:67`
**Issue:** The custom preference buttons use `min-h-[36px]`, below FISH's non-negotiable `--size-control` / 56px control target. These are real settings controls, not decorative labels, and they do not reuse the base `Button` minimum height. The edit-profile link in `apps/web/app/(authenticated)/profile/page.tsx:49` also has a 36px target while only the small link, not the whole row, is clickable.
**Fix:** Use `min-h-[var(--size-control)]` for segmented buttons, or make each settings row itself the large interactive target where appropriate.

```tsx
className={cn(
  "min-h-[var(--size-control)] rounded-pill border px-4 text-[14px] transition-colors",
  ...
)}
```

### WR-04: Profile edit can partially save one table and report overall failure

**Classification:** WARNING
**File:** `apps/web/app/(authenticated)/profile/edit/actions.ts:65`
**Issue:** The form saves `profiles.display_name` first, then saves `client_profiles` fields at lines 75-78. If the first write succeeds and the second fails, the action returns a generic failure notice at lines 80-85 while the display name has already changed. The form presents this as one save operation, so users can get a mixed persisted state.
**Fix:** Put the multi-table profile update behind a transactional database function or Edge Function/RPC, or redesign the UI/action so each table write is an independently reported operation. At minimum, update tests to cover the partial-write path and avoid saying nothing was saved when the display name already was.

```sql
-- Direction: one transaction-owned command.
create function public.update_own_client_profile(...)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles ...;
  update public.client_profiles ...;
end;
$$;
```

---

_Reviewed: 2026-07-05T01:10:18Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
