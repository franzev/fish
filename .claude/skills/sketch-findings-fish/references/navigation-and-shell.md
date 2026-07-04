# Navigation & App Shell

Validated in sketch 001 (winner **D · Synthesis**). Source: `sources/001-navigation-shell.html`.

## Decision

A **bottom-nav shell**, Messenger/WhatsApp-inspired. Four fixed destinations, left → right:

**Home · Progress · Messages · Profile**

- **Home** — calm dashboard: greets by name, surfaces the ONE assigned thing today, one primary action.
- **Progress** — milestone journey (see `profile-and-progress.md`). *Do not ship until a coach validates the tracker technique — coach-first. Until then keep 3 tabs and surface the tracker on Home.*
- **Messages** — conversation **list → thread** (not straight into one chat). See `chat.md`.
- **Profile** — identity + settings. See `profile-and-progress.md`.

Four tabs is the ceiling for this remove-choices product; a fifth erodes calm.

## Cross-platform: native per platform, shared design language

- **Web (desktop):** left **rail** (icons + labels) + **two-pane** Messages (conversation list beside the open thread — Messenger-Web pattern).
- **Android:** Material 3 **bottom navigation**; opening a thread goes **full-screen** (bottom nav hides).
- Same tokens, type, spacing on both; layout is native to each. Never force web layouts onto Android.

## Labels: always visible (decided)

Full labels on every tab. **Icon-only nav was explicitly rejected** — it conflicts with `docs/ui-ux-agent-guidelines.md` (l.644 "use labels with icons unless truly universal"; l.655/729 icon-only + "assume universal" are don'ts) and hurts the neurodivergent + non-native-English audience (labels double as vocabulary scaffolding). If a cleaner bar is ever wanted, `active-label-only` (Material 3 show-on-selected) is the furthest defensible step.

## Active state (more than color)

Web rail active = distinct fill (`--surface-3`) **+ bold label**, never equal to `:hover`. Android = the Material active **pill** (a shape) + `--ink` icon/label + bold. In the real build add `aria-current`. Never signal the current tab by color alone (guideline l.634/646).

## Brand mark

Use the real logo (`sources/logo.svg` — teal fish badge, brand teal `#1b7ba5`) inside a `.brandmark` (rounded-square, `2px solid var(--ink)` border). It is the **one sanctioned color** in an otherwise monochrome UI. Never render a placeholder letter. (Note: `apps/web/app/icon.svg` is currently mint `#75D5CA` — reconcile app icon vs logo before shipping.)

## Key CSS patterns (see source)

- `.withrail` = rail + `.tabscreen`s (show/hide via `.on`); `.botnav.labels-full|labels-active|labels-off`.
- `.brandmark { border-radius: 26%; border: 2px solid var(--ink); overflow: hidden }`.
- `.botnav-item { min-height: var(--tap) }`; active pill `.botnav-item.active .pill { background: var(--surface-3) }`.

## Anti-patterns

- ❌ Icon-only bottom nav. ❌ More than 4 tabs. ❌ Active tab that matches hover / is color-only.
- ❌ Shipping Progress before coach validation. ❌ A chart-line icon for Progress (reads as a grade — use a milestone *path*).
