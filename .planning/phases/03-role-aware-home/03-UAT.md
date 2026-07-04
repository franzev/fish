---
status: testing
phase: 03-role-aware-home
source: [03-VERIFICATION.md]
started: 2026-07-04T04:25:00Z
updated: 2026-07-04T04:25:00Z
---

## Current Test

number: 1
name: Signed-in auth-page redirects (D-05)
expected: |
  While logged in as client1@fish.dev, navigating to /login silently redirects to /home; navigating to /signup silently redirects to /home. While logged in as coach@fish.dev, navigating to /login silently redirects to /coach. Signed out, /login and /signup still show the unchanged forms. Every case resolves silently with no form flash, no error, no visible transition glitch.
awaiting: user response

## Tests

### 1. Signed-in auth-page redirects (D-05)
expected: While logged in as client1@fish.dev, navigate to /login → silent redirect to /home; navigate to /signup → silent redirect to /home. While logged in as coach@fish.dev, navigate to /login → silent redirect to /coach. Signed out, /login and /signup still show the unchanged forms. No form flash, no error, no visible transition glitch (03-04-PLAN.md Manual verification).
result: [pending]

### 2. Client home in a live browser
expected: Log in as client1@fish.dev → land on /home inside the shell with greeting "Welcome back, Alex" and copy naming "Coach Dana" (assigned-state empty state naming the real coach). Log in as coach@fish.dev → hitting /home silently forwards to /coach with no error or flash (03-02-PLAN.md Manual verification).
result: [pending]

### 3. Coach home in a live browser
expected: Log in as coach@fish.dev → /coach lists Alex Rivera, Priya Nair, Sam Okafor alphabetically with quiet emails, no other coach's clients, rows inert (no hover/cursor affordance). Log in as client1@fish.dev → hitting /coach silently forwards to /home (03-03-PLAN.md Manual verification).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
