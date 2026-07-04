# Linear Draft: Chat UI Component Library

Draft status: review only. Do not publish to Linear until Franz approves.

## Shared Linear Setup

- Team: Founders
- Assignee: Franz
- Labels: UI, Feature
- Projects: Web, Android, and Platform for shared cross-platform decisions
- Scope rule: UI components only. No live messaging, saved messages, storage uploads, notifications, or server-side behavior in this ticket set.
- Icon rule: use Tabler Icons as the approved icon family for Web and Android.
- Product rule: keep the chat calm and focused. Send is the only primary action in the chat composer. Secondary actions should be tucked into menus or quieter controls.

## Sprint Structure Through December

Use one-week Linear cycles. That matches the expected speed of working with Codex Pro and Claude Max in parallel. This chat UI component library should fit into one focused week because it is UI-only and does not include saved messages, uploads, notifications, or live chat behavior.

Create detailed tickets for the active sprint and the next sprint only. Keep later cycles as planning containers so the team can move quickly without locking December too early.

| Cycle target | Dates | Focus |
| --- | --- | --- |
| Chat UI Sprint | Jul 6-Jul 10 | Complete the Web and Android chat UI component library with mock data only |
| Chat UI Review Buffer | Jul 13-Jul 17 | Partner review feedback, carryover, and polish only |
| Weekly Product Sprint | Jul 20-Sep 25 | Next approved product work, planned one week at a time |
| Weekly Product Sprint | Sep 28-Nov 20 | Continued product work, planned one week at a time |
| Beta Polish | Nov 23-Dec 4 | Partner review feedback and quality pass |
| Release Readiness | Dec 7-Dec 18 | Stabilization and cleanup |
| Holiday Buffer | Dec 21-Dec 31 | Bugs, review feedback, no major new scope |

## Suggested One-Week Execution Order

| Day | Focus | Tickets |
| --- | --- | --- |
| Day 1 | Shared rules and chat shells | Ticket 01, Ticket 02, Ticket 10 |
| Day 2 | Text messages and composers | Ticket 03, Ticket 04, Ticket 11, Ticket 12 |
| Day 3 | Message feedback and rich message UI | Ticket 05, Ticket 06, Ticket 13, Ticket 14 |
| Day 4 | Conversation lists and message area states | Ticket 07, Ticket 08, Ticket 15, Ticket 16 |
| Day 5 | Accessibility, responsive review, and partner review fixes | Ticket 09, Ticket 17 |

## Standard Quality Bar For Every Ticket

Every ticket below should include:

- A top section that explains the user value and review path in clear product language.
- An execution section detailed enough for Codex Pro or Claude Max to pick up without extra clarification.
- Tests covering happy path, empty states, long content, small screens, disabled states, and reduced-motion behavior where relevant.
- UAT scenarios written as reviewer steps with expected outcomes.
- No migrations, new environment variables, or feature flags unless the ticket explicitly says otherwise.
- Accessibility checks for keyboard use, screen readers, touch target size, contrast, and reduced motion.
- A rollback path that is simple because this is UI-only work.

---

# Ticket 01: Chat UI Experience Rules and Component Map

Linear fields:

- Project: Platform
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: None

## Overview

Define the shared chat UI rules before Web and Android build their component libraries. This keeps both platforms consistent while avoiding a cluttered messaging experience.

## What This Gives Users

Users get a calm chat experience that feels familiar, focused, and predictable across Web and Android.

## What Is Included

- Shared component list for first release.
- Shared naming for Web and Android components.
- Shared rules for icons, message states, actions, reactions, media previews, empty states, and loading states.
- Decision on which actions are always visible and which actions live behind a menu.

## What Is Not Included

- No live chat behavior.
- No message storage.
- No file upload.
- No notification behavior.
- No production analytics.

## How To Review It

Review the component map and confirm that the planned chat experience feels focused, complete, and not overloaded.

## Objective and Scope

Create one shared source of truth for the chat UI component set. This ticket is complete when Web and Android have matching component names, matching visual states, and the same user-facing behavior rules.

## Implementation Plan

1. List all required chat UI components and group them into first release, later release, and avoid-for-now.
2. Define the shared message states: sending, sent, delivered, read, failed, loading, empty, unread, online, and offline.
3. Define the shared action model: Send is the only primary action; copy, edit, delete, reply, forward, attachment, and emoji are secondary.
4. Define the Tabler icon mapping for each visible chat action and status.
5. Define the review examples each platform must provide.
6. Confirm that Web and Android tickets below use the same names and states.

## Technical Notes

- Web should use Tabler Icons through the approved web asset path.
- Android should use Tabler SVGs converted into platform-native vector assets or an approved shared icon wrapper.
- Keep icon names aligned across platforms so design review is easy.
- No server, data, or live-message decisions belong in this ticket.

## Acceptance Criteria

- [ ] First-release chat UI component list is approved.
- [ ] Later-release components are separated from first-release scope.
- [ ] Tabler icon mapping exists for all visible chat controls and states.
- [ ] Web and Android ticket titles and component names are aligned.
- [ ] The component map explains what is UI-only and what is intentionally excluded.

## Test Cases

- Happy path: reviewer can map each requested chat UI item to a Web ticket and Android ticket.
- Negative case: actions that imply real behavior, such as upload or live send, are marked UI-only.
- Boundary case: crowded message actions do not become always-visible controls.
- Edge case: platform-specific differences are called out without changing the user experience.

## UAT Scenarios

- Scenario: Partner reviews the component map.
  Expected outcome: they can understand what will be built without reading implementation details.
- Scenario: Developer reviews the map.
  Expected outcome: they can tell which ticket owns each chat UI component.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Assumes chat is being prepared as a UI library before live chat behavior.
- Risk: adding every requested feature at once can make chat feel busy. Mitigation: separate first-release controls from later-release controls.

## Quality Considerations

- Performance: keep the first-release UI component list lean.
- Security: do not include live external content loading in this UI-only scope.
- Accessibility: define expectations for labels, focus, contrast, and reduced motion.
- Observability: no production instrumentation required.

## Rollback Strategy

Archive or revise the shared component map before platform work begins. No shipped product behavior depends on this ticket.

## Definition of Done

- Shared component map is reviewed.
- Web and Android tickets reference the same rules.
- Scope exclusions are explicit.

---

# Ticket 02: Web Chat UI Foundation

Linear fields:

- Project: Web
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 01

## Overview

Build the basic Web chat surface: header, message area, scroll layout, and responsive shell.

## What This Gives Users

Users see a stable, calm chat screen that works on desktop and mobile before any real messages are connected.

## What Is Included

- Chat container.
- Chat header with participant name, avatar, status, and quiet action buttons.
- Scrollable message area.
- Desktop and mobile layouts.
- Light and dark visual states.

## What Is Not Included

- No real message sending.
- No conversation switching.
- No saved message data.
- No notifications.

## How To Review It

Open the Web preview and confirm the chat screen feels clear, uncluttered, and usable on desktop and mobile sizes.

## Objective and Scope

Create the reusable Web chat shell that later message, composer, and conversation-list components can sit inside.

## Implementation Plan

1. Create the chat shell using existing Web layout and UI primitives.
2. Add a stable header region with avatar, participant information, presence text, and quiet action buttons.
3. Add a scrollable message area with safe spacing at the top and bottom.
4. Add responsive behavior for desktop and mobile.
5. Add preview examples for empty, loaded, and long-message-area states.
6. Confirm that the shell can be used without live data.

## Technical Notes

- Use existing design tokens and base UI components.
- Use Tabler Icons for header actions.
- Keep Send reserved as the only primary action when the composer is later added.
- Avoid adding app navigation choices inside the chat shell.

## Acceptance Criteria

- [ ] Chat shell renders on desktop and mobile.
- [ ] Header shows participant identity and status clearly.
- [ ] Message area scrolls without breaking the header or composer area.
- [ ] Layout supports light and dark themes.
- [ ] Preview states exist for empty, short, and long content.

## Test Cases

- Happy path: chat shell renders with participant info and a message area.
- Negative case: missing avatar still shows initials or fallback.
- Boundary case: very long participant name does not overlap actions.
- Edge case: small mobile viewport keeps controls readable and reachable.

## UAT Scenarios

- Scenario: Partner opens the Web chat preview on desktop.
  Expected outcome: the page reads as a chat screen immediately.
- Scenario: Partner narrows the browser.
  Expected outcome: the layout adapts without crowded or overlapping text.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on shared chat UI rules.
- Assumes existing Web design tokens are available.
- Risk: header actions may create too much visual noise. Mitigation: keep secondary actions visually quiet.

## Quality Considerations

- Performance: shell should not reflow heavily while messages load.
- Security: no unsafe rich text rendering.
- Accessibility: header actions need accessible labels and visible focus.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove the shell export and preview route/story if it causes layout regressions.

## Definition of Done

- Component is reusable.
- Preview examples are available.
- Responsive and accessibility checks pass.

---

# Ticket 03: Web Message Display Components

Linear fields:

- Project: Web
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 02

## Overview

Build the Web components that display sent and received messages.

## What This Gives Users

Users can clearly tell who said what, when it happened, and whether a message came from them or someone else.

## What Is Included

- Sent and received chat bubbles.
- Avatar image, initials, and fallback states.
- Username and timestamp.
- Long text, multiline text, and link text display.

## What Is Not Included

- No editing behavior.
- No reactions.
- No message actions.
- No live links or previews.

## How To Review It

Look at a sample conversation and confirm messages are readable, calm, and visually distinct without feeling loud.

## Objective and Scope

Create reusable Web message display components for text-based chat content.

## Implementation Plan

1. Create message bubble variants for sent and received messages.
2. Add avatar handling for image, initials, and fallback.
3. Add username and timestamp display.
4. Add examples for short, long, multiline, and consecutive messages.
5. Add spacing rules for grouped messages from the same sender.
6. Confirm message text wraps safely without layout overflow.

## Technical Notes

- Keep raw text safe; do not render message content as rich markup.
- Use existing typography and spacing tokens.
- Avoid visual grading of message status.
- Preserve readable contrast in light and dark themes.

## Acceptance Criteria

- [ ] Sent and received messages have distinct but calm styles.
- [ ] Avatars support image, initials, and fallback.
- [ ] Username and timestamp are legible without dominating the message.
- [ ] Long messages wrap cleanly.
- [ ] Consecutive messages remain easy to scan.

## Test Cases

- Happy path: normal sent and received messages render correctly.
- Negative case: missing username or avatar falls back gracefully.
- Boundary case: long unbroken text does not overflow.
- Edge case: timestamp text remains readable in both themes.

## UAT Scenarios

- Scenario: Partner reviews a sample conversation.
  Expected outcome: they can tell who sent each message and when.
- Scenario: Partner reviews a long message.
  Expected outcome: the message remains readable and does not break the layout.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Web chat shell.
- Risk: message metadata could make the UI feel busy. Mitigation: keep metadata visually secondary.

## Quality Considerations

- Performance: message components should support long lists without unnecessary heavy styling.
- Security: display text safely.
- Accessibility: message groups should have meaningful structure for assistive technology.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove message display exports and previews if they regress chat layout.

## Definition of Done

- Message display components are reusable.
- Preview examples cover common and edge states.
- UI-only scope is preserved.

---

# Ticket 04: Web Chat Input Components

Linear fields:

- Project: Web
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 02

## Overview

Build the Web chat input area as a UI component, including text entry and quiet secondary controls.

## What This Gives Users

Users have a simple place to type and send a message without being distracted by extra choices.

## What Is Included

- Text input area.
- Emoji button.
- Attachment button.
- Send button.
- Hover, focus, active, disabled, and loading states.

## What Is Not Included

- No real send behavior.
- No emoji picker.
- No file picker.
- No upload.
- No validation against saved or live message data.

## How To Review It

Type into the preview input and confirm the Send action is obvious while other controls stay quiet.

## Objective and Scope

Create the reusable Web composer component for the chat UI library.

## Implementation Plan

1. Build the composer layout with text field, secondary icon buttons, and Send button.
2. Add states for empty, typing, disabled, loading, and send-ready.
3. Use Tabler Icons for emoji, attachment, and send.
4. Ensure keyboard navigation follows a predictable order.
5. Add reduced-motion-safe transitions for focus and send-ready states.
6. Add preview examples for each state.

## Technical Notes

- The Send control is the only primary action.
- Secondary controls should use accessible labels and quiet styling.
- The component should accept callbacks but not implement real send, upload, or emoji behavior.

## Acceptance Criteria

- [ ] Composer shows text input, emoji, attachment, and Send controls.
- [ ] Empty state prevents accidental send visually and functionally in the UI.
- [ ] Loading and disabled states are clear.
- [ ] Keyboard users can reach and operate each control.
- [ ] Component remains usable on mobile width.

## Test Cases

- Happy path: typed text enables the Send UI state.
- Negative case: empty input does not show an active send-ready state.
- Boundary case: multiline text does not cover nearby controls.
- Edge case: disabled composer remains readable but cannot be operated.

## UAT Scenarios

- Scenario: Partner types a message in the preview.
  Expected outcome: Send becomes the clear next action.
- Scenario: Partner reviews the empty composer.
  Expected outcome: the screen does not invite accidental sending.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Web chat shell.
- Risk: adding emoji and attachment controls can add choice overload. Mitigation: keep them quiet and secondary.

## Quality Considerations

- Performance: composer state changes should be instant.
- Security: no file access in this UI-only ticket.
- Accessibility: visible focus, labels, and touch targets are required.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove composer export and preview if it causes chat layout regressions.

## Definition of Done

- Composer component is reusable.
- All visual states are previewable.
- No real send/upload behavior is introduced.

---

# Ticket 05: Web Message Feedback Components

Linear fields:

- Project: Web
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 03 and Ticket 04

## Overview

Build Web UI components for message status, typing, reply previews, reactions, and message actions.

## What This Gives Users

Users can understand message state and respond to messages without the chat becoming crowded.

## What Is Included

- Sending, sent, delivered, read, and failed visual states.
- Typing indicator with three dots.
- Reply and quoted message preview.
- Emoji reaction display.
- Message actions: copy, edit, delete, reply, forward.

## What Is Not Included

- No real editing, deleting, forwarding, or replying behavior.
- No actual read receipts.
- No live typing connection.

## How To Review It

Review a sample conversation with these states turned on and confirm the feedback is helpful but not distracting.

## Objective and Scope

Create reusable Web feedback components for visual chat states and secondary message interactions.

## Implementation Plan

1. Add message status indicators using shared status names.
2. Add animated typing indicator with reduced-motion fallback.
3. Add quoted reply component for previewing the original message.
4. Add reaction display and compact reaction count variants.
5. Add message action menu using Tabler Icons.
6. Add preview examples for each state and combination.

## Technical Notes

- Actions should be visually secondary and generally hidden behind a menu or contextual control.
- Use accessible menu labels and keyboard behavior.
- Failed state should guide calmly without alarming styling.

## Acceptance Criteria

- [ ] Status indicators render for all shared states.
- [ ] Typing indicator animates and respects reduced motion.
- [ ] Reply preview is readable and compact.
- [ ] Reactions are visible without dominating messages.
- [ ] Message actions are accessible and do not clutter the bubble.

## Test Cases

- Happy path: each status renders the expected icon/text treatment.
- Negative case: unknown status falls back safely.
- Boundary case: several reactions remain compact.
- Edge case: reduced-motion setting disables or simplifies typing animation.

## UAT Scenarios

- Scenario: Partner reviews a message with reactions and actions.
  Expected outcome: they can find actions without feeling the message is crowded.
- Scenario: Partner reviews typing and sending states.
  Expected outcome: the feedback feels calm and understandable.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Web message display and composer components.
- Risk: actions can make chat feel busy. Mitigation: expose actions progressively.

## Quality Considerations

- Performance: animations should be lightweight.
- Security: no clipboard/write actions are required in this UI-only ticket.
- Accessibility: menus and status text need labels for assistive technology.
- Observability: no production instrumentation required.

## Rollback Strategy

Disable feedback component exports or remove previews without affecting the chat shell.

## Definition of Done

- Feedback states are reusable.
- Preview examples cover each state.
- Motion and accessibility checks pass.

---

# Ticket 06: Web Media Message Components

Linear fields:

- Project: Web
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 03

## Overview

Build Web UI components for rich message types such as images, videos, files, audio, voice messages, and YouTube preview cards.

## What This Gives Users

Users can recognize different message types clearly without needing the media to be connected to real uploads yet.

## What Is Included

- Image message UI.
- Video message UI.
- File message UI.
- Audio message UI.
- Voice message player UI.
- YouTube link preview card UI.

## What Is Not Included

- No upload.
- No playback integration beyond UI states.
- No YouTube fetching.
- No storage or permissions work.

## How To Review It

Review sample media messages and confirm each type is recognizable, calm, and appropriately sized.

## Objective and Scope

Create reusable Web media message components with placeholder data and safe visual states.

## Implementation Plan

1. Build image, video, file, audio, and voice message UI variants.
2. Build YouTube preview card UI using static sample data.
3. Add loading, unavailable, and failed media states.
4. Add Tabler Icons for file, audio, play, pause, download, and external link controls.
5. Add examples for small and large media.
6. Confirm layout behaves inside sent and received bubbles.

## Technical Notes

- Use static placeholder media or safe local mock data only.
- Do not fetch remote media as part of this ticket.
- Keep controls large enough for touch and keyboard use.

## Acceptance Criteria

- [ ] All required media message types have UI components.
- [ ] Loading and unavailable states are represented.
- [ ] Media components work in sent and received message positions.
- [ ] File names and titles wrap safely.
- [ ] YouTube preview is clearly a preview UI, not a live fetch.

## Test Cases

- Happy path: each media type renders with sample data.
- Negative case: missing thumbnail or title shows a fallback.
- Boundary case: long file names wrap without overflow.
- Edge case: unavailable media state remains calm and understandable.

## UAT Scenarios

- Scenario: Partner reviews a media-heavy sample conversation.
  Expected outcome: each message type is easy to identify.
- Scenario: Partner reviews a failed media preview.
  Expected outcome: the state explains the issue without feeling alarming.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Web message display components.
- Risk: rich media can overwhelm the chat. Mitigation: use compact cards and restrained controls.

## Quality Considerations

- Performance: media previews should reserve stable space to avoid layout jumps.
- Security: no remote rendering or unsafe rich text.
- Accessibility: media controls need labels and keyboard support.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove media component exports and previews without affecting text message display.

## Definition of Done

- Media UI variants are reusable.
- Error/loading states are previewable.
- No live upload or playback integration is introduced.

---

# Ticket 07: Web Conversation List Components

Linear fields:

- Project: Web
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 02

## Overview

Build the Web sidebar and conversation list components for browsing active chats in a focused way.

## What This Gives Users

Users can see their conversations, unread counts, and presence without losing focus on the active chat.

## What Is Included

- Conversation list/sidebar.
- Search field UI.
- Unread badges.
- Online/offline presence indicator.
- Loading older conversations UI.
- Mobile and desktop layouts.

## What Is Not Included

- No real search.
- No live unread counts.
- No conversation switching behavior.
- No notifications.

## How To Review It

Review the conversation list beside the chat and on mobile. Confirm the active conversation stays clear.

## Objective and Scope

Create reusable Web conversation list components for chat navigation UI only.

## Implementation Plan

1. Build conversation list item variants for active, unread, muted, loading, and empty states.
2. Add search field UI without real filtering behavior.
3. Add unread badge and presence indicator components.
4. Add desktop sidebar layout.
5. Add mobile layout where the list and chat do not compete for attention.
6. Add preview examples for full, empty, and loading lists.

## Technical Notes

- Keep the active chat visually clear.
- Use Tabler Icons for search and quiet list actions.
- Avoid adding plan/template browsing patterns.

## Acceptance Criteria

- [ ] Conversation list displays participant, last message preview, timestamp, unread badge, and presence.
- [ ] Search UI is present but clearly UI-only.
- [ ] Desktop layout supports sidebar plus active chat.
- [ ] Mobile layout avoids cramped two-column UI.
- [ ] Empty and loading states are previewable.

## Test Cases

- Happy path: list renders multiple conversations with one active item.
- Negative case: empty list shows a calm empty state.
- Boundary case: long participant names and message previews truncate cleanly.
- Edge case: many unread badges do not dominate the screen.

## UAT Scenarios

- Scenario: Partner reviews desktop conversation list.
  Expected outcome: active chat is obvious and the list is easy to scan.
- Scenario: Partner reviews mobile conversation list.
  Expected outcome: the screen does not feel cramped or overloaded.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Web chat shell.
- Risk: search and unread UI may imply live behavior. Mitigation: label preview data and keep ticket UI-only.

## Quality Considerations

- Performance: list items should remain lightweight for long lists.
- Security: no real user data is used.
- Accessibility: list selection, search, and badges need screen reader clarity.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove conversation list exports and previews without affecting the core chat shell.

## Definition of Done

- List components are reusable.
- Desktop and mobile examples are available.
- UI-only behavior is explicit.

---

# Ticket 08: Web Chat Empty, Loading, and Unread States

Linear fields:

- Project: Web
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 02 and Ticket 03

## Overview

Build the Web UI states that make chat feel understandable when there are no messages, loading messages, or unread messages.

## What This Gives Users

Users always understand what is happening, even before messages appear or while older messages are loading.

## What Is Included

- Empty chat state.
- Loading and skeleton placeholders.
- Unread message divider.
- Loading older messages state.
- Smooth new-message transition examples.

## What Is Not Included

- No actual message loading.
- No real unread tracking.
- No realtime behavior.

## How To Review It

Review empty, loading, and unread examples and confirm the screen feels calm and self-explanatory.

## Objective and Scope

Create reusable Web state components for the chat message area.

## Implementation Plan

1. Build empty chat state with warm, concise copy.
2. Build skeleton/loading placeholders for message rows.
3. Build unread divider.
4. Build loading older messages indicator.
5. Add new-message transition example with reduced-motion fallback.
6. Add previews for each state.

## Technical Notes

- Copy should guide without scolding.
- Progress or loading states should never feel like a grade.
- Respect reduced-motion settings.

## Acceptance Criteria

- [ ] Empty state explains the chat state clearly.
- [ ] Loading placeholders match message layout.
- [ ] Unread divider is visible without being loud.
- [ ] Loading older messages state is reusable.
- [ ] Motion respects reduced-motion preferences.

## Test Cases

- Happy path: loading state transitions to sample messages in preview.
- Negative case: empty state works without participant data.
- Boundary case: unread divider works between dense message groups.
- Edge case: reduced-motion mode disables nonessential animation.

## UAT Scenarios

- Scenario: Partner reviews an empty chat.
  Expected outcome: the screen feels calm and not broken.
- Scenario: Partner reviews unread divider.
  Expected outcome: they can identify new content without feeling interrupted.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Web shell and message display components.
- Risk: empty state copy can feel cold or instructional. Mitigation: keep it short and warm.

## Quality Considerations

- Performance: skeletons should be lightweight.
- Security: no real user data.
- Accessibility: loading states should expose appropriate busy state where useful.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove these state components and previews without affecting core message display.

## Definition of Done

- Empty, loading, unread, and older-message states are reusable.
- Preview examples cover each state.
- Motion and accessibility expectations are met.

---

# Ticket 09: Web Chat Accessibility and Responsive Review

Linear fields:

- Project: Web
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Tickets 02-08

## Overview

Review and polish the Web chat UI component library for accessibility, responsiveness, and visual consistency.

## What This Gives Users

Users get a chat interface that is readable, keyboard-friendly, touch-friendly, and stable across screen sizes.

## What Is Included

- Keyboard navigation review.
- Screen reader label review.
- Color contrast review.
- Reduced-motion review.
- Mobile, tablet, and desktop layout review.
- Final component preview cleanup.

## What Is Not Included

- No new chat features.
- No server-side behavior.
- No broad redesign outside the chat UI components.

## How To Review It

Use the final Web chat preview at several screen sizes and confirm nothing overlaps, disappears, or becomes hard to use.

## Objective and Scope

Bring the Web chat UI component set to a review-ready quality bar.

## Implementation Plan

1. Audit keyboard order for the chat shell, composer, message actions, and conversation list.
2. Audit screen reader labels for icon buttons, status indicators, badges, and menus.
3. Check contrast in light and dark themes.
4. Check reduced-motion behavior for typing, new messages, and reactions.
5. Check mobile, tablet, and desktop layouts.
6. Fix defects found during review and update previews.

## Technical Notes

- This ticket is polish and verification, not new feature scope.
- Any large new feature request should become a separate ticket.

## Acceptance Criteria

- [ ] Keyboard navigation is predictable.
- [ ] Icon-only controls have clear labels.
- [ ] Text and controls meet contrast expectations.
- [ ] Reduced-motion mode is respected.
- [ ] No visual overlap occurs on common viewport sizes.

## Test Cases

- Happy path: reviewer can navigate core chat controls by keyboard.
- Negative case: disabled controls are announced and cannot be operated.
- Boundary case: narrow mobile layout keeps all controls reachable.
- Edge case: very long text does not overlap controls.

## UAT Scenarios

- Scenario: Partner reviews final Web chat on desktop and mobile.
  Expected outcome: the interface feels stable and easy to understand.
- Scenario: Developer tests keyboard-only use.
  Expected outcome: all interactive controls can be reached and identified.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on all Web chat UI component tickets.
- Risk: review finds scope creep. Mitigation: convert new feature requests into later tickets.

## Quality Considerations

- Performance: no visible layout jank during state changes.
- Security: no live data or external content changes.
- Accessibility: this is the primary focus of the ticket.
- Observability: no production instrumentation required.

## Rollback Strategy

Revert individual polish changes that cause regressions. No data rollback needed.

## Definition of Done

- Final Web chat component previews are review-ready.
- Accessibility and responsive checks are complete.
- Any remaining issues are filed separately.

---

# Ticket 10: Android Chat UI Foundation

Linear fields:

- Project: Android
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 01

## Overview

Build the basic Android chat surface: header, message area, scroll layout, and responsive phone/tablet shell.

## What This Gives Users

Users get a native Android chat screen that matches the Web experience while feeling natural on Android.

## What Is Included

- Chat container.
- Chat header with participant name, avatar, status, and quiet action buttons.
- Scrollable message area.
- Phone and tablet layouts.
- Light and dark visual states.

## What Is Not Included

- No real message sending.
- No saved message data.
- No notifications.
- No conversation switching behavior.

## How To Review It

Open the Android preview and confirm the chat screen feels clear, calm, and native.

## Objective and Scope

Create the reusable Android chat shell that later Android message, composer, and list components can use.

## Implementation Plan

1. Build the native chat shell with existing Android design system patterns.
2. Add a stable header region with avatar, participant details, presence text, and quiet action buttons.
3. Add a scrollable message area with safe spacing.
4. Add phone and tablet preview examples.
5. Add light and dark previews.
6. Confirm the shell runs with mock data only.

## Technical Notes

- Use Android-native components and existing design constants.
- Convert Tabler Icons into approved Android vector assets or use the approved Android icon wrapper.
- Keep Send reserved as the only primary action when the composer is later added.

## Acceptance Criteria

- [ ] Android chat shell renders in preview.
- [ ] Header shows participant identity and status clearly.
- [ ] Message area scrolls without breaking the header or composer area.
- [ ] Phone and tablet previews are available.
- [ ] Light and dark states are supported.

## Test Cases

- Happy path: chat shell renders with participant info and message area.
- Negative case: missing avatar still shows initials or fallback.
- Boundary case: long participant name does not overlap controls.
- Edge case: tablet layout stays readable without becoming sparse.

## UAT Scenarios

- Scenario: Partner reviews Android phone preview.
  Expected outcome: the screen reads as chat immediately.
- Scenario: Partner reviews tablet preview.
  Expected outcome: the layout uses space well without adding unnecessary choices.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on shared chat UI rules.
- Risk: Android and Web drift visually. Mitigation: use the shared component map and icon names.

## Quality Considerations

- Performance: preview should remain smooth with mock message lists.
- Security: no unsafe rich text or remote content.
- Accessibility: TalkBack labels and large touch targets are required.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove Android chat shell preview and component exports if layout regressions occur.

## Definition of Done

- Android chat shell is reusable.
- Phone/tablet and light/dark previews exist.
- UI-only scope is preserved.

---

# Ticket 11: Android Message Display Components

Linear fields:

- Project: Android
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 10

## Overview

Build the Android components that display sent and received messages.

## What This Gives Users

Users can clearly tell who sent each message, when it was sent, and whether it came from them or someone else.

## What Is Included

- Sent and received chat bubbles.
- Avatar image, initials, and fallback states.
- Username and timestamp.
- Long text and multiline message display.

## What Is Not Included

- No editing behavior.
- No reactions.
- No message actions.
- No live links or previews.

## How To Review It

Review the Android sample conversation and confirm messages are readable and calm.

## Objective and Scope

Create reusable Android message display components for text-based chat content.

## Implementation Plan

1. Create sent and received message bubble variants.
2. Add avatar handling for image, initials, and fallback.
3. Add username and timestamp display.
4. Add previews for short, long, multiline, and grouped messages.
5. Confirm text wraps safely on narrow phones.
6. Match shared Web behavior where appropriate.

## Technical Notes

- Use native text rendering and avoid unsafe rich text rendering.
- Keep metadata visually secondary.
- Use shared design constants for spacing, color, and shape.

## Acceptance Criteria

- [ ] Sent and received bubbles are visually distinct and calm.
- [ ] Avatar fallback states work.
- [ ] Username and timestamp are readable.
- [ ] Long messages wrap cleanly.
- [ ] Previews cover common and edge states.

## Test Cases

- Happy path: normal conversation renders correctly.
- Negative case: missing avatar or name falls back gracefully.
- Boundary case: long unbroken text does not overflow.
- Edge case: message metadata remains readable in dark mode.

## UAT Scenarios

- Scenario: Partner reviews sample Android conversation.
  Expected outcome: they can tell who sent each message.
- Scenario: Partner reviews long messages.
  Expected outcome: the layout remains readable and stable.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Android chat shell.
- Risk: too much metadata can clutter the bubble. Mitigation: keep timestamp and username quiet.

## Quality Considerations

- Performance: message rows should be lightweight.
- Security: no unsafe content rendering.
- Accessibility: message text and sender context should be understandable with TalkBack.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove message display preview and component exports if they cause regressions.

## Definition of Done

- Android message components are reusable.
- Preview examples cover common states.
- UI-only scope is preserved.

---

# Ticket 12: Android Chat Input Components

Linear fields:

- Project: Android
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 10

## Overview

Build the Android chat input area as a UI component, including text entry and quiet secondary controls.

## What This Gives Users

Users have a simple, native place to type and send a message without extra distractions.

## What Is Included

- Text input area.
- Emoji button.
- Attachment button.
- Send button.
- Pressed, focused, disabled, and loading states.

## What Is Not Included

- No real send behavior.
- No emoji picker.
- No file picker.
- No upload.
- No validation against saved or live message data.

## How To Review It

Use the Android preview and confirm Send is the clear next action while other controls stay secondary.

## Objective and Scope

Create the reusable Android composer component for the chat UI library.

## Implementation Plan

1. Build the composer layout with text input, secondary icon controls, and Send.
2. Add empty, typing, disabled, loading, and send-ready states.
3. Use Tabler Icons for emoji, attachment, and send.
4. Ensure controls meet touch target expectations.
5. Confirm TalkBack labels for all icon controls.
6. Add previews for each state.

## Technical Notes

- Send is the only primary action.
- The component may accept callbacks for future behavior but must not implement real send, upload, or emoji behavior.
- Keep keyboard behavior natural for Android.

## Acceptance Criteria

- [ ] Composer shows text input, emoji, attachment, and Send controls.
- [ ] Empty input does not show an active send-ready state.
- [ ] Loading and disabled states are clear.
- [ ] Controls are large enough for touch.
- [ ] TalkBack labels are available for icon controls.

## Test Cases

- Happy path: typed text enables send-ready visual state.
- Negative case: empty text leaves Send visually inactive.
- Boundary case: multiline text does not cover controls.
- Edge case: disabled state remains readable but inactive.

## UAT Scenarios

- Scenario: Partner types into the Android composer preview.
  Expected outcome: Send becomes the obvious next action.
- Scenario: Partner reviews the empty composer.
  Expected outcome: the UI feels calm and does not invite accidental action.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Android chat shell.
- Risk: secondary controls add too much choice. Mitigation: keep them visually quiet and consistently placed.

## Quality Considerations

- Performance: composer state changes should feel instant.
- Security: no file access in this UI-only ticket.
- Accessibility: TalkBack labels, visible focus, and touch targets are required.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove composer preview and component exports if it causes regressions.

## Definition of Done

- Android composer is reusable.
- All visual states are previewable.
- No real send/upload behavior is introduced.

---

# Ticket 13: Android Message Feedback Components

Linear fields:

- Project: Android
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 11 and Ticket 12

## Overview

Build Android UI components for message status, typing, reply previews, reactions, and message actions.

## What This Gives Users

Users can understand message state and use secondary message actions without the conversation becoming crowded.

## What Is Included

- Sending, sent, delivered, read, and failed visual states.
- Typing indicator with three dots.
- Reply and quoted message preview.
- Emoji reaction display.
- Message actions: copy, edit, delete, reply, forward.

## What Is Not Included

- No real edit, delete, forward, or reply behavior.
- No actual read receipts.
- No live typing connection.

## How To Review It

Review Android sample messages with status and actions shown. Confirm the actions are findable but not noisy.

## Objective and Scope

Create reusable Android feedback components for visual chat states and secondary message interactions.

## Implementation Plan

1. Add message status indicators using shared names.
2. Add typing indicator with reduced-motion-safe behavior.
3. Add quoted reply preview.
4. Add reaction display and count variants.
5. Add long-press or menu-based message actions using Tabler Icons.
6. Add previews for each state and combination.

## Technical Notes

- Message actions should not all be permanently visible.
- Prefer native Android interaction patterns for contextual actions.
- Failed state should guide calmly without alarming styling.

## Acceptance Criteria

- [ ] Status indicators render for all shared states.
- [ ] Typing indicator works and respects reduced motion where available.
- [ ] Reply preview is compact and readable.
- [ ] Reactions are visible without dominating messages.
- [ ] Message actions are accessible and not cluttered.

## Test Cases

- Happy path: each status renders correctly.
- Negative case: unknown status falls back safely.
- Boundary case: several reactions stay compact.
- Edge case: accessibility services can identify action labels.

## UAT Scenarios

- Scenario: Partner reviews Android message actions.
  Expected outcome: actions are available without making every message feel busy.
- Scenario: Partner reviews typing and status states.
  Expected outcome: the feedback is understandable and calm.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Android message display and composer.
- Risk: action menus may differ from Web. Mitigation: match meaning and icon names while using native Android patterns.

## Quality Considerations

- Performance: lightweight animations only.
- Security: no real clipboard or destructive actions required in UI-only scope.
- Accessibility: TalkBack labels and menu navigation are required.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove feedback previews and component exports if they cause regressions.

## Definition of Done

- Android feedback states are reusable.
- Preview examples cover each state.
- Accessibility expectations are met.

---

# Ticket 14: Android Media Message Components

Linear fields:

- Project: Android
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 11

## Overview

Build Android UI components for rich message types such as images, videos, files, audio, voice messages, and YouTube preview cards.

## What This Gives Users

Users can recognize different message types clearly before real uploads or playback are connected.

## What Is Included

- Image message UI.
- Video message UI.
- File message UI.
- Audio message UI.
- Voice message player UI.
- YouTube link preview card UI.

## What Is Not Included

- No upload.
- No playback integration beyond UI states.
- No YouTube fetching.
- No storage or permissions work.

## How To Review It

Review Android sample media messages and confirm each message type is recognizable and calm.

## Objective and Scope

Create reusable Android media message components with mock data and safe visual states.

## Implementation Plan

1. Build image, video, file, audio, and voice message UI variants.
2. Build YouTube preview card UI using static sample data.
3. Add loading, unavailable, and failed media states.
4. Add Tabler Icons for file, audio, play, pause, download, and external link controls.
5. Add phone and tablet previews for small and large media.
6. Confirm media components work inside sent and received message positions.

## Technical Notes

- Use static placeholder media or safe mock data only.
- Do not request device storage permissions in this ticket.
- Do not fetch remote media in this ticket.

## Acceptance Criteria

- [ ] All required media message types have Android UI components.
- [ ] Loading and unavailable states are represented.
- [ ] Components work in sent and received positions.
- [ ] Long file names and titles wrap safely.
- [ ] YouTube preview is UI-only.

## Test Cases

- Happy path: each media type renders with sample data.
- Negative case: missing thumbnail or title shows fallback.
- Boundary case: long file names do not overflow.
- Edge case: unavailable media state stays calm and clear.

## UAT Scenarios

- Scenario: Partner reviews Android media sample conversation.
  Expected outcome: each media type is easy to identify.
- Scenario: Partner reviews failed media state.
  Expected outcome: the message explains the state without alarm.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Android message display.
- Risk: media cards can dominate the conversation. Mitigation: keep cards compact and consistent.

## Quality Considerations

- Performance: media cards should reserve stable space and avoid layout jumps.
- Security: no storage permission or remote content loading.
- Accessibility: media controls need TalkBack labels.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove media previews and component exports without affecting text messages.

## Definition of Done

- Android media UI variants are reusable.
- Error/loading states are previewable.
- No upload or playback integration is introduced.

---

# Ticket 15: Android Conversation List Components

Linear fields:

- Project: Android
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 10

## Overview

Build Android conversation list components for showing active chats, unread counts, presence, and search UI.

## What This Gives Users

Users can scan conversations and return to the active chat without feeling overloaded.

## What Is Included

- Conversation list.
- Search field UI.
- Unread badges.
- Online/offline presence indicator.
- Loading older conversations UI.
- Phone and tablet layouts.

## What Is Not Included

- No real search.
- No live unread counts.
- No conversation switching behavior.
- No notifications.

## How To Review It

Review the Android list preview and confirm it is easy to scan without pulling focus away from the active chat.

## Objective and Scope

Create reusable Android conversation list components for chat navigation UI only.

## Implementation Plan

1. Build conversation row variants for active, unread, muted, loading, and empty states.
2. Add search field UI without real filtering behavior.
3. Add unread badge and presence indicator components.
4. Add phone layout.
5. Add tablet layout if the app supports a wider chat view.
6. Add previews for full, empty, and loading lists.

## Technical Notes

- Use native Android list patterns.
- Use Tabler Icons for search and quiet list actions.
- Do not add plan/template browsing patterns.

## Acceptance Criteria

- [ ] Conversation list displays participant, last message preview, timestamp, unread badge, and presence.
- [ ] Search UI is present but UI-only.
- [ ] Phone layout is readable and focused.
- [ ] Tablet layout avoids unnecessary choices.
- [ ] Empty and loading states are previewable.

## Test Cases

- Happy path: list renders several conversations with one active item.
- Negative case: empty list shows calm empty state.
- Boundary case: long names and previews truncate safely.
- Edge case: unread badges remain visually restrained.

## UAT Scenarios

- Scenario: Partner reviews Android conversation list.
  Expected outcome: the active chat is easy to find.
- Scenario: Partner reviews empty list state.
  Expected outcome: the screen feels intentional, not broken.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Android chat shell.
- Risk: list UI may imply live chat navigation. Mitigation: keep the ticket UI-only and use mock data.

## Quality Considerations

- Performance: list rows should remain lightweight.
- Security: no real user data.
- Accessibility: list rows, search, and badges need TalkBack clarity.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove list previews and component exports without affecting the chat shell.

## Definition of Done

- Android list components are reusable.
- Phone and tablet previews are available.
- UI-only behavior is explicit.

---

# Ticket 16: Android Chat Empty, Loading, and Unread States

Linear fields:

- Project: Android
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Ticket 10 and Ticket 11

## Overview

Build Android UI states for empty chat, loading messages, unread messages, and loading older messages.

## What This Gives Users

Users always understand what is happening, even when messages have not appeared yet.

## What Is Included

- Empty chat state.
- Loading and skeleton placeholders.
- Unread message divider.
- Loading older messages state.
- New-message transition examples.

## What Is Not Included

- No actual message loading.
- No real unread tracking.
- No realtime behavior.

## How To Review It

Review Android empty, loading, and unread examples and confirm they feel calm and clear.

## Objective and Scope

Create reusable Android state components for the chat message area.

## Implementation Plan

1. Build empty chat state with short, warm copy.
2. Build skeleton/loading placeholders.
3. Build unread divider.
4. Build loading older messages indicator.
5. Add new-message transition example with reduced-motion-safe behavior where available.
6. Add previews for each state.

## Technical Notes

- Copy should guide without scolding.
- Loading states should not look like progress grades.
- Use native Android motion patterns sparingly.

## Acceptance Criteria

- [ ] Empty state explains the chat state clearly.
- [ ] Loading placeholders match message layout.
- [ ] Unread divider is visible without being loud.
- [ ] Loading older messages state is reusable.
- [ ] Motion is calm and not required to understand the UI.

## Test Cases

- Happy path: loading state transitions to sample messages in preview.
- Negative case: empty state works without participant data.
- Boundary case: unread divider works between dense message groups.
- Edge case: motion can be reduced without losing meaning.

## UAT Scenarios

- Scenario: Partner reviews Android empty chat.
  Expected outcome: the screen feels calm and not broken.
- Scenario: Partner reviews unread divider.
  Expected outcome: new content is easy to spot without feeling loud.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on Android shell and message display components.
- Risk: empty state copy may feel instructional. Mitigation: keep it short and warm.

## Quality Considerations

- Performance: loading placeholders should be lightweight.
- Security: no real user data.
- Accessibility: loading and empty states need TalkBack-friendly labels where useful.
- Observability: no production instrumentation required.

## Rollback Strategy

Remove state previews and component exports without affecting message display.

## Definition of Done

- Empty, loading, unread, and older-message states are reusable.
- Preview examples cover each state.
- Accessibility expectations are met.

---

# Ticket 17: Android Chat Accessibility and Responsive Review

Linear fields:

- Project: Android
- Cycle target: Chat UI Sprint, Jul 6-Jul 10
- Blocked by: Tickets 10-16

## Overview

Review and polish the Android chat UI component library for accessibility, responsive layouts, and visual consistency.

## What This Gives Users

Users get an Android chat interface that is readable, touch-friendly, TalkBack-friendly, and stable across screen sizes.

## What Is Included

- TalkBack label review.
- Touch target review.
- Color contrast review.
- Reduced-motion review where available.
- Phone and tablet layout review.
- Final component preview cleanup.

## What Is Not Included

- No new chat features.
- No server-side behavior.
- No broad redesign outside the Android chat UI components.

## How To Review It

Use the final Android previews and confirm nothing overlaps, disappears, or becomes hard to use.

## Objective and Scope

Bring the Android chat UI component set to a review-ready quality bar.

## Implementation Plan

1. Audit TalkBack labels for icon buttons, status indicators, badges, menus, and media controls.
2. Audit touch target sizes for all controls.
3. Check contrast in light and dark modes.
4. Check motion and transition behavior.
5. Check phone and tablet layouts.
6. Fix defects found during review and update previews.

## Technical Notes

- This ticket is polish and verification, not new feature scope.
- Any large new feature request should become a separate ticket.

## Acceptance Criteria

- [ ] TalkBack can identify core controls and statuses.
- [ ] Touch targets are large enough for reliable use.
- [ ] Text and controls meet contrast expectations.
- [ ] Motion is calm and not required for understanding.
- [ ] No visual overlap occurs on supported screen sizes.

## Test Cases

- Happy path: reviewer can understand the screen with TalkBack labels.
- Negative case: disabled controls are identifiable and inactive.
- Boundary case: narrow phones keep controls reachable.
- Edge case: very long content does not overlap actions.

## UAT Scenarios

- Scenario: Partner reviews final Android previews.
  Expected outcome: the interface feels stable and easy to understand.
- Scenario: Developer reviews TalkBack behavior.
  Expected outcome: all interactive controls can be identified.

## Configuration, Migrations, and Environment Updates

None.

## Dependencies, Assumptions, and Risks

- Depends on all Android chat UI component tickets.
- Risk: review finds scope creep. Mitigation: create separate later tickets for new features.

## Quality Considerations

- Performance: no visible layout jank during state changes.
- Security: no live data or external content changes.
- Accessibility: this is the primary focus of the ticket.
- Observability: no production instrumentation required.

## Rollback Strategy

Revert individual polish changes that cause regressions. No data rollback needed.

## Definition of Done

- Final Android chat component previews are review-ready.
- Accessibility and responsive checks are complete.
- Any remaining issues are filed separately.
