---
phase: 10
slug: chat-message-loading-optimization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (web unit/integration) + @testing-library/react · Playwright (cross-role e2e) · fixture vectors in `packages/core/src/chat-state/fixtures` run through the web vitest host |
| **Config file** | `apps/web` vitest setup (existing — Wave 0 verifies fixture reach into `packages/core`) |
| **Quick run command** | `pnpm --filter @fish/web exec vitest run` |
| **Full suite command** | `pnpm build && pnpm lint && pnpm typecheck && pnpm --filter @fish/web exec vitest run` |
| **Estimated runtime** | ~30s quick · ~3 min full |

**Constraint (from phase directive):** no Claude Preview MCP / no dev-server-based manual verification during execution — validation is tests + build gates + Playwright e2e only.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @fish/web exec vitest run`
- **After every plan wave:** Run `pnpm build && pnpm lint && pnpm typecheck && pnpm --filter @fish/web exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green (Playwright e2e included where a plan touches cross-role flows)
- **Max feedback latency:** 60 seconds (quick command)

---

## Per-Task Verification Map

*(Filled by the planner — every task must map a CLOAD requirement to an automated check.)*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-XX-XX | XX | X | CLOAD-XX | — | RLS-scoped reads only | unit / fixture / e2e | `pnpm --filter @fish/web exec vitest run <file>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Fixture-vector stubs for the new portable pagination events (hydrate-window / older-page-loaded / gap-backfill) in `packages/core/src/chat-state/fixtures` — covering CLOAD-02/-05/-06 merge cases (out-of-order arrival, duplicate delivery, backfill overlap, pagination-during-live-insert)
- [ ] Unit-test stubs for cursor/window selectors and scroll-anchor bookkeeping helpers (CLOAD-01/-03/-04)
- [ ] Confirm the web vitest host picks up `packages/core/src/chat-state` test/fixture files (framework already installed — no new install)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reading position feels fixed while older pages load (no perceptible jump/jank) | CLOAD-04 | Pixel-level smoothness is human-judged; automated tests assert anchor math, not perception | Seed (`pnpm seed`), open the general channel, scroll up through ≥3 pages; the message under the eye must not move; loader rows must not shift layout |
| Loading/offline states read as calm (monochrome, notice tone, no alarm) | CLOAD-06 / XC-03 | Tone/visual-calm judgment | With network throttled offline→online, observe reconnect state: notice tone only, no red, no scolding copy, position preserved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (vitest invoked with `run`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
