# AGENTS.md

FISH is a ChatHub that teaches English to neurodivergent professionals (many with ADHD). Build for calm and focus: the product's whole job is to **remove choices**, not add them.

## Stack

- Monorepo managed with pnpm workspaces.
- Web: Next.js (App Router) + React + TypeScript in `apps/web`.
- iOS: native SwiftUI in `apps/ios`.
- Android: native Kotlin + Jetpack Compose in `apps/android`.
- Tailwind CSS **v4** for web — CSS-first config via `@theme` in `apps/web/app/globals.css`. There is **no `tailwind.config.js`**; do not create one. Keep `tailwindcss` and `@tailwindcss/postcss` on the **same** version or the build breaks.
- Supabase (auth + database + storage + realtime + Edge Functions) — one backend service, no separate auth provider and no Express API unless the product proves it needs one.
- Package manager: pnpm (lockfile is `pnpm-lock.yaml`; do not use npm).

## Commands

```bash
pnpm dev         # local web dev server
pnpm build       # production web build + shared package typechecks; must pass before any commit
pnpm lint
pnpm typecheck
```

Native projects are opened with platform tools:

- iOS: `apps/ios/FISH.xcodeproj`
- Android: `apps/android`

## The product rule that governs everything

**Coach-first, code-second.** Don't build a feature until a coach has proven the technique works manually with a real client. If asked to build a learning feature (exercises, the community feed, gamification), check it has been validated first; if unclear, ask rather than assume.

## Design rules (non-negotiable, apply to every screen)

These are the reason the UI looks sparse. Do not "improve" screens by adding options.
Before designing any UI, changing a user-facing screen, or reviewing UI components,
read `docs/ui-ux-agent-guidelines.md` first. That guide is the consolidated
PDF-derived UI/UX review reference for this product.

1. **One primary action per screen.** At most one `Button variant="primary"` per view. Two competing choices is a bug.
2. **Assigned, never chosen.** Users never browse a menu of plans/templates. The coach assigns; the app presents. No "pick one of N" UI for clients.
3. **Big tap targets.** Controls are min 56px tall (`--size-control` on web). Nothing tiny or fiddly.
4. **Progress is visual, never a grade.** Use the `Progress` bar / milestones. No scores, no percentages-as-judgement.
5. **Gamification is reward-only.** Never build a streak that resets to zero — broken streaks are the top abandonment trigger for this audience. Reward returning, never punish a gap.
6. **Copy never scolds.** Errors explain and guide in the app's voice; they use the soft `notice` color, never alarming red. Sentence case, plain verbs.

## Design tokens — use these, never raw hex in web

Defined in `apps/web/app/globals.css` under `@theme`. Reference via Tailwind utilities:

- `bg-bg` `bg-surface` `bg-surface-2` — backgrounds (near-black → dark)
- `bg-primary` `text-on-primary` — high-contrast primary inversion; the single action on a screen
- `text-foreground` (white, headings) · `text-body` (grey) · `text-muted` (dim)
- `text-notice`
- `rounded-card` (16px) · `rounded-control` (12px) · `rounded-pill`
- Fonts are loaded in `apps/web/app/layout.tsx`.

Native clients should mirror these tokens in platform-native constants until a generated token pipeline exists.

## Code conventions (only what differs from defaults)

- Web: reuse the base components in `apps/web/components/ui/` (`Button`, `Input`, `Card`, `Progress`). Extend them rather than hand-rolling new buttons/inputs.
- Named exports for components; `forwardRef` for any focusable control.
- Use the `cn()` helper from `apps/web/lib/utils.ts` for conditional web classes.
- Keep accessibility floor: visible keyboard focus, `prefers-reduced-motion` respected (both already set in web `globals.css`).
- Keep shared product contracts in `packages/core`; keep Supabase auth/database contracts in `packages/supabase`.

## API boundary

- Use Supabase directly for simple authorized reads protected by RLS.
- Use Supabase Edge Functions for command-style writes and sensitive logic such as sending messages, assigning clients, moderation checks, and future AI-assisted coaching.
- Do not add a Node/Express API service by default.

## Build order (foundations first — do these before any learning feature)

1. Auth + roles (client / coach) on Supabase
2. Client profiles
3. 1-on-1 chat (NOT the community feed — that waits)
4. Shared UI kit

## Never

- Don't add a `tailwind.config.js` (v4 is CSS-first).
- Don't give clients screens with menus, galleries, or multi-choice plan pickers.
- Don't build community/gamification/streaks before the foundations above are done and the technique is validated.
