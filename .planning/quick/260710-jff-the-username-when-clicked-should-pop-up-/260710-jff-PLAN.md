---
phase: quick-260710-jff
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/lib/auth/use-logout.ts
  - apps/web/components/shell/user-menu.tsx
  - apps/web/components/shell/user-menu.test.tsx
  - apps/web/components/auth/logout-button.tsx
  - apps/web/components/shell/app-shell.tsx
  - apps/web/components/shell/app-shell.test.tsx
autonomous: true
requirements: [QUICK-260710-jff]

must_haves:
  truths:
    - "Clicking the username in the header opens a popup menu"
    - "The popup menu shows Profile (client only) and Log out"
    - "Choosing Profile navigates to /profile"
    - "Choosing Log out signs the user out, clears the chat store, and returns to /login"
    - "There is no longer a standalone Log out button in the header"
    - "The header still carries zero primary actions (D-09)"
  artifacts:
    - path: "apps/web/lib/auth/use-logout.ts"
      provides: "Shared logout handler (signOut + clearChatStore + router.push) so CR-01 logic is single-sourced"
      exports: ["useLogout"]
    - path: "apps/web/components/shell/user-menu.tsx"
      provides: "Username-triggered Base UI Menu with Profile + Log out items"
      exports: ["UserMenu"]
    - path: "apps/web/components/shell/app-shell.tsx"
      provides: "Header renders UserMenu instead of a name link + standalone LogoutButton"
      contains: "UserMenu"
  key_links:
    - from: "apps/web/components/shell/user-menu.tsx"
      to: "apps/web/lib/auth/use-logout.ts"
      via: "useLogout hook"
      pattern: "useLogout"
    - from: "apps/web/components/shell/app-shell.tsx"
      to: "apps/web/components/shell/user-menu.tsx"
      via: "UserMenu render in header"
      pattern: "UserMenu"
---

<objective>
Replace the header's "username link + standalone Log out button" with a single
username control that opens a popup menu offering **Profile** and **Log out**.
Remove the always-visible Log out button from the header (it stays in the Profile
settings screen, which is untouched).

Purpose: Consolidate account actions behind one quiet trigger so the shell stays
calm and choice-free (D-09: zero primary actions in the bar), matching the
validated sketch-findings navigation direction.

Output: A `UserMenu` client island, a shared `useLogout` hook, updated `AppShell`
wiring, and updated tests — all passing under `pnpm test` and `pnpm build`.
</objective>

<execution_context>
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/workflows/execute-plan.md
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/templates/summary.md
</execution_context>

<context>
@apps/web/components/shell/app-shell.tsx
@apps/web/components/auth/logout-button.tsx
@apps/web/components/chat/composer/add-menu.tsx
@apps/web/components/shell/app-shell.test.tsx

MANDATORY design reference — read before touching the shell:
@.claude/skills/sketch-findings-fish/SKILL.md
@.claude/skills/sketch-findings-fish/references/navigation-and-shell.md

<interfaces>
<!-- Established Base UI Menu pattern (from add-menu.tsx) — reuse it directly, do not invent a new menu. -->

Menu structure (from apps/web/components/chat/composer/add-menu.tsx):
  Menu.Root > Menu.Trigger > Menu.Portal > Menu.Positioner > Menu.Popup > Menu.Item[]
  - Import: `import { Menu } from "@base-ui/react/menu";`
  - Popup class in use: "min-w-menu rounded-card border border-border bg-surface p-3xs shadow-popover"
  - Item class in use: "flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2"
  - Base UI Menu supplies roving focus, Escape/outside dismiss, and focus return for free.
  - Menu.Item accepts a `render` prop for polymorphism (e.g. render as a next/link `Link`).

Current logout logic (from apps/web/components/auth/logout-button.tsx — must be preserved, incl. CR-01):
  signOut()  from "@/lib/auth/browser"
  clearChatStore()  from "@/app/(authenticated)/chat/store/chat-store"  // CR-01: prevents cross-account draft/message leakage
  router.push("/login")

Current header account block (app-shell.tsx lines ~160-172):
  - role === "client": displayName rendered as <Link href="/profile"> (muted, truncate, md:max-w-48)
  - role === "coach": displayName rendered as a plain <span> (coaches have NO /profile view)
  - always followed by <LogoutButton className="shrink-0" />

IMPORTANT: `LogoutButton` is ALSO used by apps/web/app/(authenticated)/profile/page.tsx
(the "Sign out" settings row). DO NOT delete logout-button.tsx or its test — only
remove it from the header.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add useLogout hook and the UserMenu popup component</name>
  <files>apps/web/lib/auth/use-logout.ts, apps/web/components/shell/user-menu.tsx, apps/web/components/shell/user-menu.test.tsx</files>
  <behavior>
    UserMenu (client component):
    - Trigger: renders `displayName` as a real button (Menu.Trigger) styled with the
      SAME muted/truncate/layout classes the header name currently uses
      ("min-w-0 flex-1 truncate rounded-control text-ui-sm text-muted hover:text-foreground md:max-w-48 md:flex-none"),
      plus min-h-control so it meets the 56px tap-target floor. Give it an accessible
      label (aria-label like `Account menu for {displayName}` or aria-haspopup semantics
      Base UI already provides).
    - Popup items (reuse the add-menu Popup/Item classes verbatim; Tabler icons only):
      * Profile — ONLY when role === "client". Rendered as a Menu.Item that IS a real
        link to /profile (use Menu.Item `render={<Link href="/profile" />}`). Icon: IconUser.
      * Log out — always present. A Menu.Item button whose onClick calls the useLogout
        hook's logout(). Icon: IconLogout.
    - Zero Button variant="primary" anywhere in this file (D-09).

    Tests (user-menu.test.tsx) — mock next/navigation (usePathname/useRouter),
    "@/lib/auth/browser" (signOut → ok), and the chat-store clearChatStore:
    - Test 1: trigger shows the display name and opens the menu on click (client) →
      Profile link (href="/profile") and a "Log out" item are visible.
    - Test 2: for role="coach", opening the menu shows Log out but NO Profile link.
    - Test 3: clicking Log out calls signOut, calls clearChatStore, and pushes "/login".

    useLogout (apps/web/lib/auth/use-logout.ts):
    - Client hook returning { logout, loading }. logout() = setLoading(true) → await
      signOut() → clearChatStore() (CR-01) → router.push("/login"). Same imports/order
      as the current LogoutButton so behavior is identical.
  </behavior>
  <action>Create `useLogout` in apps/web/lib/auth/use-logout.ts by lifting the exact handler currently inside logout-button.tsx (signOut, then clearChatStore for CR-01, then router.push("/login")), returning { logout, loading }. Then build `UserMenu` in apps/web/components/shell/user-menu.tsx as a "use client" island using the Base UI Menu pattern from add-menu.tsx — trigger is the display name (styled per the header's current muted name classes + min-h-control), items are Profile (client-only, a real Link via Menu.Item render prop, IconUser) and Log out (Menu.Item calling useLogout().logout, IconLogout). Reuse the existing Popup/Item class strings from add-menu.tsx; monochrome tokens only, no raw hex, no one-off numeric spacing. Add a short WHY comment noting D-09 (bar stays zero-primary) and that Log out routes through the shared hook to keep CR-01 single-sourced. Write user-menu.test.tsx covering the three behaviors above (mirror the mocking style already in app-shell.test.tsx).</action>
  <verify>
    <automated>pnpm --filter @fish/web test run components/shell/user-menu.test.tsx</automated>
  </verify>
  <done>UserMenu renders the name as a menu trigger; opening it shows Profile (client only) + Log out; Log out invokes signOut + clearChatStore + push("/login"); user-menu.test.tsx passes; no variant="primary" in the file.</done>
</task>

<task type="auto">
  <name>Task 2: Wire UserMenu into the header, drop the standalone button, update tests</name>
  <files>apps/web/components/auth/logout-button.tsx, apps/web/components/shell/app-shell.tsx, apps/web/components/shell/app-shell.test.tsx</files>
  <action>Refactor logout-button.tsx to consume the new `useLogout` hook instead of its inline handler (behavior and the ghost Button unchanged — its existing test and the profile "Sign out" row must keep passing). In app-shell.tsx: remove the `LogoutButton` import and its `<LogoutButton className="shrink-0" />` usage, and replace the client-link / coach-span display-name block (lines ~160-172) with a single `<UserMenu displayName={displayName} role={role} />`. Keep the header's flex spacer and overall layout intact. Do NOT delete logout-button.tsx (still used by profile/page.tsx). Then update app-shell.test.tsx to match the new behavior: (a) the "renders the muted display name and the logout button" test → assert the display name renders as the menu trigger and that Log out is reachable via the menu (open it, then assert the Log out item), not as an always-visible header button; (b) the "links the client display name to /profile" test → assert clicking the trigger opens a menu whose Profile item links to /profile; (c) the "does not link the coach display name" test → assert the coach trigger opens a menu with Log out and NO Profile item; (d) the D-09/SHEL-01 zero-primary test → also read user-menu.tsx and assert zero variant="primary" across app-shell.tsx + user-menu.tsx (logout-button.tsx may remain in that assertion since the file still exists). Preserve all channel/nav/preference tests unchanged.</action>
  <verify>
    <automated>pnpm --filter @fish/web test run components/shell components/auth/logout-button.test.tsx && pnpm --filter @fish/web build</automated>
  </verify>
  <done>Header shows only the UserMenu (no standalone Log out button); app-shell.test.tsx + logout-button.test.tsx pass; `pnpm build` succeeds; profile "Sign out" row still works.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| authenticated session → sign-out | Log out must fully end the session and purge per-account local state |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Information Disclosure | Log out menu item | mitigate | Route Log out through the shared `useLogout` hook so `clearChatStore()` (CR-01) always runs before redirect — a different account on the same tab cannot inherit drafts/pending messages. Covered by user-menu.test.tsx Test 3. |
| T-quick-02 | Elevation of Privilege | Profile menu item | accept | Profile is a plain client-side `Link` to /profile guarded by existing route auth/RLS; the menu adds no new data path. |
| T-quick-SC | Tampering | npm/pip/cargo installs | accept | No new packages installed; reuses already-adopted @base-ui/react and @tabler/icons-react. |
</threat_model>

<verification>
- `pnpm --filter @fish/web test run components/shell components/auth/logout-button.test.tsx` — all green
- `pnpm --filter @fish/web build` — succeeds
- Grep gate: `grep -v '^#' apps/web/components/shell/app-shell.tsx | grep -c 'variant="primary"'` returns 0
- Grep gate: `grep -c 'LogoutButton' apps/web/components/shell/app-shell.tsx` returns 0 (removed from header)
</verification>

<success_criteria>
- Clicking the username opens a menu with Profile (client only) and Log out.
- Profile navigates to /profile; Log out signs out, clears the chat store, returns to /login.
- No standalone Log out button remains in the header; the Profile settings "Sign out" row still works.
- Header carries zero primary actions (D-09); monochrome + spacing tokens only; 56px tap target on the trigger.
- All shell and logout tests pass; production build passes.
</success_criteria>

<output>
Create `.planning/quick/260710-jff-the-username-when-clicked-should-pop-up-/260710-jff-SUMMARY.md` when done
</output>
