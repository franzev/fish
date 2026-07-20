# AGENTS.md

FISH is a ChatHub that teaches English to neurodivergent professionals (many with ADHD). Build for calm and focus: the product's whole job is to **remove choices**, not add them.

## Stack

- Monorepo managed with pnpm workspaces.
- Web: Next.js (App Router) + React + TypeScript in `apps/web`.
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

## The product rule that governs everything

**Coach-first, code-second.** Don't build a feature until a coach has proven the technique works manually with a real client. If asked to build a learning feature (exercises, the community feed, gamification), check it has been validated first; if unclear, ask rather than assume.

## Native mobile scope (iOS and Android)

The native mobile apps are intentionally **direct-chat-only for now**. Keep
their product surface centered on direct conversations and capabilities that
support those conversations. Do not propose or add mobile home/dashboard,
lesson booking, assigned-work, learning-exercise, community, marketplace, or
other web-product surfaces unless the user explicitly changes this scope.

## Design rules (non-negotiable, apply to every screen)

These are the reason the UI looks sparse. Do not "improve" screens by adding options.
Before designing any UI, changing a user-facing screen, or reviewing UI components,
read `docs/ui-ux-agent-guidelines.md` first. That guide is the consolidated
PDF-derived UI/UX review reference for this product.

1. **One primary action per screen.** At most one `Button variant="primary"` per view. Two competing choices is a bug.
2. **Assigned, never chosen.** Users never browse a menu of plans/templates. The coach assigns; the app presents. No "pick one of N" UI for clients.
3. **Accessible targets, sized by context.** Touch-first and frequently used controls use at least a 44×44px interaction target. A control may look smaller when padding or its surrounding clickable area preserves that target. Compact desktop controls and inline text links are allowed. Keep primary actions 56px tall when the extra prominence supports focus.
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
- Spacing: use the named Tailwind utilities generated from `--spacing-*`
  tokens, such as `gap-sm`, `gap-md`, `mt-lg`, `px-md`, `py-xl`, and
  semantic utilities built on those tokens.
- Fonts are loaded in `apps/web/app/layout.tsx`.

### Spacing discipline

Spacing is part of the design system. It must communicate intent, not raw
implementation details.

- Use only predefined spacing tokens (`spacing-3xs`, `spacing-2xs`,
  `spacing-nudge`, `spacing-xs`, `spacing-compact`, `spacing-sm`,
  `spacing-field-y`, `spacing-md`, `spacing-page`, `spacing-lg`,
  `spacing-xl`, `spacing-2xl`, or semantic spacing tokens such as
  `spacing-control`) for margins, padding, gaps, layout separation, and
  `space-*` rhythm.
- Use token-based Tailwind utilities like `mt-lg`, `gap-md`, `px-sm`, or
  semantic utilities backed by those tokens.
- Do not introduce one-off numeric spacing utilities such as `mt-6`,
  `space-y-4`, `gap-5`, `px-3`, or `py-7`.
- If a new spacing value is truly needed, add it to the design system first
  with a semantic name and intent.
- Components should stay consistent, scalable, and easy to maintain by relying
  exclusively on the spacing token system.

## Code conventions (only what differs from defaults)

- Web: reuse the base components in `apps/web/components/ui/` (`Button`, `Input`, `Card`, `Progress`). Extend them rather than hand-rolling new buttons/inputs.
- Named exports for components; `forwardRef` for any focusable control.
- Use the `cn()` helper from `apps/web/lib/utils.ts` for conditional web classes.
- Keep accessibility floor: visible keyboard focus, `prefers-reduced-motion` respected (both already set in web `globals.css`).
- Keep shared product contracts in `packages/core`; keep Supabase auth/database contracts in `packages/supabase`.

### Component folder structure (non-negotiable)

Every React component implementation must live in its own same-named folder.
This applies to shared, feature-owned, and route-local components.

- Use `components/component-name/component-name.tsx` for shared and
  feature-owned components.
- Use `_components/component-name/component-name.tsx` for components private
  to an App Router route segment.
- Colocate the component's tests, stories, and private helpers in that folder.
- Every component folder must contain an `index.ts` entry point. When it
  exposes the component's complete public surface, use
  `export * from "./component-name"`.
- Grouping folders may contain component folders, helpers, and barrels, but
  never loose component implementation `.tsx` files.
- The folder name and implementation filename must match in kebab-case.
- Next.js special route files such as `page.tsx`, `layout.tsx`, `loading.tsx`,
  `error.tsx`, and `not-found.tsx`, plus framework configuration files such as
  Storybook `preview.tsx`, are exempt.
- Before completing structural work, run the module-boundary test and verify
  that there are zero loose component implementations and zero component
  folders without an `index.ts`.

### Exports and barrels

- When a barrel or forwarding module is intended to expose a source module's
  complete public surface, use `export * from "..."` (or the type-only
  equivalent, `export type * from "..."`) instead of maintaining a one-by-one
  export list. This applies across the entire repository, including feature,
  UI, runtime, and package entry points.
- Use explicit named re-exports only when they enforce an intentional public
  API subset, preserve a client/server boundary, rename a symbol, resolve an
  export-name collision, maintain a compatibility surface, or shield generated
  or provider-specific internals.
- Whenever exports are added, removed, or renamed in a source module, check
  every barrel and forwarding layer in that path so public entry points cannot
  silently drift out of sync.

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
