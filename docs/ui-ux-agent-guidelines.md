# UI/UX Agent Guidelines

This guide consolidates the UI/UX principles extracted from every PDF under
`uiux/` and adapts them to FISH. Use it when implementing, reviewing, or
refining any user-facing screen.

The short version: FISH is a calm coaching product for neurodivergent
professionals. The UI should reduce cognitive load, preserve focus, and make
the next step obvious. Good visual design matters, but only when it makes the
product easier to understand and use.

## Source Coverage

These guidelines synthesize:

- `uiux/Designing_User_Interfaces_EN_2024_FINAL.pdf.pdf`
- `uiux/noBullshit_2025.pdf`
- `uiux/ui-styles-2024.pdf`
- `uiux/ducking-designers-guide.pdf`
- `uiux/UI-design-tips.pdf`
- `uiux/dark-version-updated.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/css_selector_best_practices.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/five_css_mistakes_to_avoid.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/how_to_organize_your_css_codebase.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/how_to_properly_name_css_classes.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/html_forms_best_practices.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/html_learning_roadmap.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/real_world_examples_of_semantic_html.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/semantic_html_use_cases.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/seven_common_html_mistakes.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/twitter_best_practices_css.pdf`
- `uiux/+100 slides on HTML & CSS Best practices/web_images_best_practices.pdf`

## Precedence Rules

When sources overlap or conflict, use this order:

1. `AGENTS.md` product rules win.
2. Existing code tokens and base components win.
3. This document wins over generic PDF advice.
4. General PDF advice is a reference, not permission to add complexity.

Important project-specific overrides:

- FISH uses `--size-target-touch` / 44px for touch-first and frequently used
  controls. Primary actions may use `--size-control-primary` / 56px when the
  extra prominence supports focus. Compact desktop controls and inline links
  may be smaller when context and spacing keep them easy to operate.
- PDFs often use red for errors; FISH uses calm semantic tones and helpful
  copy. Never use alarming red as the main experience.
- PDFs sometimes recommend title case labels; FISH copy uses sentence case.
- PDFs discuss multi-option choice UI; FISH clients should receive assigned
  next steps, not browse or choose from plan/template menus.
- PDFs include many visual styles; FISH is intentionally sparse and
  monochrome. Treat trendy effects as exceptions, not a direction.

## Core Product Principles

### Reduce Choices

Every screen should answer one question: what is the next useful thing the
user can do?

Do:

- Keep one primary action per screen.
- Remove options that are not needed for the current task.
- Split complex flows into small, logical steps.
- Show progress visually when a flow is long.
- Let coaches assign next steps.

Do not:

- Add galleries, pickers, or menus of learning plans for clients.
- Put two visually equal primary actions beside each other.
- Ask for information that can be inferred, prefilled, deferred, or assigned.
- Add feature controls just because the app could support them.

Example:

- Do: one assigned check-in with one `Continue` or `Send update` action.
- Do not: a screen that asks the client to choose from several templates,
  difficulty levels, and optional learning paths.

### Coach-First, Code-Second

Learning features must come from validated coaching practice. If an exercise,
community feature, gamification idea, or learning mechanic
has not been validated manually by a coach, pause and ask.

Do:

- Implement foundations first: auth, profiles, 1-on-1 chat, shared UI kit.
- Keep the app flexible enough for coaches to assign work manually.
- Favor simple primitives over hard-coded learning templates.

Do not:

- Encode an unvalidated teaching technique as a product feature.
- Add gamification before the foundations and validation exist.
- Build streaks that reset or punish gaps.

### Design, Test, Repeat

The UX PDFs repeatedly reduce the work to a practical loop: understand the
problem, design a solution, test it with real users, and iterate.

Do:

- Use real coach/client evidence where possible.
- Prefer short user interviews, usability checks, and production observations
  over process theater.
- For meaningful UX changes, test the core flow rather than debating taste.
- If testing a prototype, make it mid or high fidelity enough that users can
  understand it.

Do not:

- Add personas, journey maps, or workshops as deliverables unless they help
  the actual decision.
- Treat social-media "which design is better?" opinions as user research.
- Use A/B testing to justify manipulative or user-hostile behavior.

## Visual Hierarchy

Hierarchy is how the screen tells the user what matters first, second, and
last. Use hierarchy before decoration.

### Hierarchy Model

For every screen or component, identify:

- Context: where the user is and why this screen exists.
- Clarification: the minimum information needed to decide.
- Action: the single next step.

This is adapted from the hierarchy-strips method in the PDFs. The spaces
between groups matter as much as the groups themselves.

Do:

- Make the highest-priority content visually strongest.
- Put supporting information near the thing it explains.
- Place the final action where the user's scan path naturally ends.
- Use bigger spacing between unrelated groups than within a group.

Do not:

- Give all text, cards, or buttons the same visual weight.
- Put unrelated items close together just to save vertical space.
- Let decorative elements be noticed before task-critical content.

Example:

- Do: heading, one short explanation, input group, primary button.
- Do not: heading, long paragraph, three links, two cards, tooltip, and a
  primary button all with equal emphasis.

### Proximity

Users assume close items belong together.

Do:

- Keep labels close to their fields.
- Group related fields under a clear section label if the form is long.
- Separate destructive or rare actions from common actions.
- Add more space before a new task group than between items in the same group.

Do not:

- Use the same gap between every element.
- Put logout, delete, or cancel actions beside routine navigation.
- Separate a field from its label with the same gap used between field groups.

### One Primary Action

FISH screens may have at most one `Button variant="primary"` per view.

Do:

- Use primary for the one action that moves the user forward.
- Use secondary, ghost, or text links for alternatives.
- Make alternatives visibly quieter.

Do not:

- Use two primary buttons in one screen section.
- Use the same fill color for two different choices.
- Make cancel/destructive actions more visually dominant than the desired
  action.

Examples:

- Do: `Cancel` as ghost, `Clear history` as the only emphasized action.
- Do not: `Cancel` and `OK` styled identically.
- Do: `Create account`.
- Do not: `Next`, `OK`, `Submit`, or `Click here`.

## Layout And Spacing

### Use A Spacing System

FISH should use an 8-point spacing mindset, with occasional 4px or 12px
sub-steps inside compact components when needed. Avoid random numbers.

Good values:

- Component internals: `4`, `8`, `12`, `16`
- Component grouping: `16`, `24`, `32`
- Section grouping: `40`, `48`, `64`

Do:

- Use spacing tokens/classes that map to the design system.
- Make inner component spacing smaller than outer layout spacing.
- Keep equal items equally spaced.
- Use whitespace as a divider before adding borders.

Do not:

- Use magic numbers because they "look right" once.
- Patch alignment with one-off offsets.
- Fill empty space just because it exists.

Example:

- Do: label to input gap around `8px`, input to helper text around `4px`.
- Do not: `13px`, `19px`, and `27px` gaps in the same form without a clear
  token or reason.

### Web Layout

The PDFs recommend a 12-column web grid, around 1120px content width, and
32px gutters for content-heavy or marketing-style pages. FISH product screens
are usually calmer and narrower.

Do:

- Prefer single-column flows for auth, profile editing, chat, and client work.
- Keep content width constrained so text stays readable.
- Use side whitespace intentionally on desktop.
- For dense coach/admin views, use grids only when comparison or scanning
  benefits from it.

Do not:

- Stretch long text across wide screens.
- Add columns just because desktop has room.
- Make marketing-style hero layouts for operational product screens.

Line length:

- Mobile body text: aim for roughly 30-50 characters per line.
- Desktop body text: avoid very long lines; around 6-9 words per line is a
  useful readability target for dense copy.

### Mobile Layout

Mobile should usually be one column.

Do:

- Use generous side margins, typically 24px or 32px.
- Keep internal spacing one step smaller than side spacing.
- Use full-width primary actions for focused flows.
- Let users scroll instead of cramming content.

Do not:

- Create multi-column forms on mobile.
- Hide essential context above the fold to avoid scrolling.
- Use small controls to fit more content.

### Tablet Layout

Do:

- Use a single column where the task is linear.
- Use two columns only when the content naturally compares or pairs.
- Increase side margins compared with phone layouts.

Do not:

- Stretch a phone layout across the tablet width.
- Create arbitrary columns that break the user's task flow.

## Typography

FISH web currently uses Lexend for body text and Fraunces for headings. Use
the loaded fonts and existing typography conventions.

### Type Scale

Do:

- Keep most screens to 3-4 text styles.
- Use body text around 17px on web, matching the existing system.
- Use labels/captions around 14-15px.
- Use clear size and weight differences for headings, body, labels, and meta.
- Use relative line-height, not fixed absolute line-height.

Do not:

- Add many near-identical text sizes.
- Use thin/light weights for UI text.
- Use decorative fonts inside product UI.
- Use viewport-scaled type.

### Readability

Do:

- Prefer regular, medium, semibold, and bold weights.
- Keep body line height generous, around 1.5.
- Keep headings tighter, around 1.15.
- Use left alignment for forms and long text.
- Use centered text only for short empty states or compact captions.

Do not:

- Justify text in UI.
- Use all caps for sentence-length content.
- Use all caps for multi-word buttons in FISH.
- Introduce new negative letter spacing; follow the existing text styles.

Examples:

- Do: `Create account`
- Do not: `CREATE ACCOUNT`
- Do: `Something needs your attention before you can continue.`
- Do not: `ERROR 51526C`

## Color And Dark Mode

### Use Tokens Only

On web, use Tailwind utilities backed by `apps/web/app/globals.css`.

Do:

- Use `bg-bg`, `bg-surface`, `bg-surface-2`.
- Use `bg-primary` and `text-on-primary` for the one primary action.
- Use `text-foreground`, `text-body`, and `text-muted` for hierarchy.
- Use semantic feedback tokens such as `text-notice`, `text-error`,
  `text-warning`, and `text-success` only through the design system.

Do not:

- Use raw hex values in web UI.
- Create a `tailwind.config.js`.
- Add one-off dark-mode branches when the token already handles light/dark.
- Assume a specific hue for `primary`; use the token.

### Hierarchy Before Color

FISH is intentionally restrained. Color should clarify status or action, not
decorate the screen.

Do:

- Make structure work in monochrome first.
- Reserve the strongest contrast for the primary action.
- Use muted text for secondary information.
- Keep decorative color usage minimal.

Do not:

- Use multiple bright decorative colors on one screen.
- Use color alone to communicate state.
- Make background color louder than the task.

### Dark Mode

Dark mode is not a simple inversion.

Do:

- Keep the closest visual layer lighter than the background.
- Use surface lightness steps instead of shadows in dark mode.
- Keep text slightly softened while still passing contrast.
- Test primary action contrast against dark surfaces.
- Avoid large saturated surfaces that steal focus from cards or forms.

Do not:

- Put darker cards on lighter dark backgrounds.
- Use pure black plus pure white everywhere.
- Depend on dark shadows to show elevation.
- Use pure black for animation-heavy or scrolling areas if it causes smearing.

### Contrast

Do:

- Meet WCAG AA for essential text and UI.
- Keep focus rings visible on every surface.
- Verify contrast in both light and dark themes.
- Treat decorations as optional; they may fail contrast only when the core UI
  remains fully understandable without them.

Do not:

- Use low-contrast text because it "looks soft".
- Let placeholders be confused with entered text.
- Let disabled styles be the model for normal text.

## Components

Use base components from `apps/web/components/ui/` before creating new ones.
Project-standard components include `Button`, `Input`, `Card`, `Progress`, and
`Alert`; if a standard component is missing, add it there rather than
hand-rolling one-off versions per screen.

### Component States

Every interactive component must account for:

- Default
- Hover, where hover exists
- Focus-visible
- Active/pressed
- Disabled, if applicable
- Loading/busy, if applicable
- Empty, success, warning, error, or notice states where relevant

Do:

- Keep state changes layout-stable.
- Use `aria-busy`, `aria-describedby`, and other semantic attributes where
  appropriate.
- Preserve keyboard focus.
- Document or test state variants when adding shared components.

Do not:

- Add borders, spinners, or messages that resize the component unexpectedly.
- Remove focus outlines.
- Depend only on color changes for selected or error states.

### Buttons

Buttons perform actions. Links navigate.

Do:

- Use `<button>` for actions and `<a>`/`Link` for navigation.
- Keep buttons rectangular or rounded-rectangular.
- Use direct verb labels.
- Make the whole target comfortably clickable.
- Keep icon and label alignment optically centered.
- Use loading states that preserve button width and height.

Do not:

- Use `div` as a button.
- Use non-rectangular action shapes.
- Use vague labels such as `OK`, `Next`, `Submit`, or `Save` when a more
  specific verb exists.
- Disable submit buttons merely because the form is incomplete if inline
  guidance would be clearer.
- Leave a clicked submit active while the request is in flight.

Examples:

- Do: `Send message`
- Do not: `Submit`
- Do: `Log in instead`
- Do not: `Continue`
- Do: `Clear history`
- Do not: `OK`

### Forms And Inputs

Forms are high-risk UI. They must be quiet, linear, forgiving, and explicit.

Do:

- Use a real `<form>`.
- Use visible labels associated with controls.
- Keep labels above fields and left-aligned.
- Use a single-column layout by default.
- Keep forms narrow enough to scan comfortably.
- Use field-specific helper text and errors directly under the field.
- Reserve space for hint/error text where possible to prevent layout jumps.
- Use `type`, `autocomplete`, `inputmode`, `enterkeyhint`, `min`, `max`, and
  `pattern` when they reduce user effort.
- Use `aria-describedby` for helper and error text.
- Provide password reveal controls where users may need to verify entry.
- Prefer marking optional fields over adding red required asterisks.

Do not:

- Use placeholders as labels.
- Center labels above fields.
- Mix rectangular inputs and underline-only inputs in one product.
- Hide invalid fields inside collapsed accordions.
- Put all errors at the top of the form without field-level messages.
- Use `type="number"` for phone numbers, card numbers, ZIP/postal codes, or
  account numbers; use `inputmode="numeric"` where appropriate.
- Split names into first/last/prefix fields unless the product truly needs the
  split.

Examples:

```tsx
<Input
  label="Email"
  type="email"
  autoComplete="email"
  enterKeyHint="next"
  error="That does not look like an email yet. Check the spelling?"
/>
```

Do not:

```tsx
<input placeholder="Email" />
```

### Checkboxes, Radios, Dropdowns, Toggles

Do:

- Use checkboxes for independent on/off selections that are submitted with a
  form.
- Top-align checkboxes/radios with the first line of long labels.
- Wrap labels so the label text is also clickable.
- Use radio groups for one choice among a small set.
- Use dropdowns/selects for larger option sets, typically more than five.
- Add typeahead/filtering for long lists.
- Use toggles only for settings that take immediate effect.

Do not:

- Use toggles for terms acceptance or choices that still require a submit
  button.
- Use dropdowns for 3-5 options when visible radios or segmented controls are
  clearer.
- Write confusing negative labels such as "I do not want to be left without
  updates".
- Present client learning choices as plan/template pickers.

### Cards

Cards should hold one subject. FISH should use them sparingly.

Do:

- Use cards for repeated items, modals, and genuinely framed tools.
- Keep one clear subject per card.
- Keep card content concise.
- Keep internal padding consistent.
- Use one primary card action, or make the whole card the action when no
  explicit CTA exists.
- Test cards with longest realistic content.

Do not:

- Put cards inside cards.
- Turn full page sections into floating cards.
- Pack cards with filler metadata.
- Put multiple equal CTAs inside one card.
- Let images occupy most of a card unless the image is the content.

### Alerts, Notices, And Errors

Do:

- Explain what happened and what the user can do next.
- Place field-specific messages next to the relevant field.
- Use calm semantic tones and icons.
- Keep copy short, human, and specific.
- Use toast/overlay alerts only for transient status, not form validation.

Do not:

- Scold the user.
- Use raw technical errors.
- Use exclamation-heavy copy.
- Depend only on red text.
- Show permanent UI in a toast.

Examples:

- Do: `That did not send. Give it a minute and try again.`
- Do not: `ERROR: MESSAGE_SEND_FAILURE`

### Progress

Progress is visual, never a grade.

Do:

- Use progress bars or milestones for multi-step flows.
- Name steps with meaningful labels, such as `Basic info`, `Location`, or
  `Password`.
- Allow previous completed steps to be reviewed when safe.
- Use skeleton screens for predictable loading structures.

Do not:

- Show scores or percentages as judgement.
- Use progress to shame inactivity.
- Use broken streaks or reset-to-zero mechanics.
- Show empty loading screens with no status.

### Tables And Structured Data

Use tables only when comparing structured data matters. Coach/admin surfaces
may need them; client learning surfaces usually should not.

Do:

- Left-align text.
- Right-align numbers.
- Keep column headers visible for long tables.
- Use pagination for large datasets.
- Add search, sorting, and filtering when they reduce scan time.
- On mobile, convert small tables to stacked cell/card views when possible.
- Keep labels visible if horizontal scroll is unavoidable.

Do not:

- Center table content.
- Use infinite scroll for serious tabular data.
- Force side-scrolling mobile tables for six or fewer columns.
- Hide context while the user scrolls.

Charts:

- Use honest scales.
- Make graph lines thick enough to read.
- Do not use color alone; add patterns, labels, or shape differences.
- Keep tooltips readable with enough padding.

## Navigation

Visible navigation is easier than hidden navigation.

Do:

- Keep navigation consistent across views.
- Use labels with icons unless the icon is truly universal and the context is
  obvious.
- Make active states clear with more than color alone.
- Keep main mobile navigation to a small number of categories.
- Keep menu items large enough to tap.
- Use breadcrumbs only for deep hierarchical content.

Do not:

- Hide primary navigation in a menu when it can be visible.
- Move navigation around between screens.
- Use icon-only navigation for unfamiliar actions.
- Let clients browse learning plans or templates.

FISH-specific note:

- Coach/admin users may need lists, filters, and management navigation.
- Client users should see assigned work and a clear next action.

## Modals, Overlays, Tooltips, And Action Sheets

Overlay UI interrupts the user. Use it only when the interruption is useful.

Do:

- Open modals/popups only after a user action.
- Provide an obvious close button with a large target.
- Allow escape/outside click where appropriate.
- Keep the main action visually distinct from secondary actions.
- Keep modal text to the minimum needed.
- Use action sheets for mobile action sets when they match platform
  expectations.
- Use tooltips only for non-essential help.
- Prefer inline help over tooltips on mobile.

Do not:

- Show automatic entry/exit popups.
- Put core instructions only in a tooltip.
- Put rich UI or multi-step decisions inside a tooltip.
- Use tiny low-contrast close controls.
- Make overlays look unrelated to the app.

## Motion And Interaction

Motion should explain state, not perform.

Do:

- Respect `prefers-reduced-motion`.
- Use animation for navigation context, progress, and microfeedback.
- Keep transitions short and calm.
- Use easing for natural motion.
- Use microinteractions only on actionable elements.
- Show loading with progress, skeletons, or stable spinners.

Do not:

- Animate decorative elements constantly.
- Bounce or overshoot large UI in a way that draws attention from the task.
- Animate inactive text or objects in ways that imply clickability.
- Use motion as the only state indicator.

FISH web already has calm opacity/translate utilities. Prefer those patterns.

## Images, Icons, And Media

### Icons

FISH uses Tabler Icons on web. Keep one icon family per platform unless a
platform-native equivalent is deliberately chosen.

Do:

- Use one consistent icon style in a given context.
- Keep stroke width, corner style, and visual weight consistent.
- Use labels for non-universal icons.
- Keep icon buttons large enough even if the icon itself is small.
- Use SVG/icon components, not raster images, for UI icons.

Do not:

- Mix filled and outlined icons for equal-status items.
- Mix icon sets.
- Use detailed icons at tiny sizes.
- Assume an icon is universal for every audience.

### Images

Do:

- Use `<img>`/Next image components for content images.
- Use CSS backgrounds only for decorative imagery.
- Provide meaningful `alt` text for content images.
- Use empty alt for decorative images.
- Use responsive sizes (`srcset`/`sizes` or framework equivalents).
- Lazy-load offscreen images where appropriate.
- Use WebP/modern formats with fallback where needed.

Do not:

- Use background images for content users need to understand.
- Place text on busy photos without a readable overlay.
- Use staged, irrelevant stock imagery.
- Modify user-uploaded images with brand filters unless the feature requires
  it and users understand it.

FISH note:

- Product screens should not rely on decorative media. If imagery is used, it
  must support the task or emotional reassurance without stealing focus.

## Accessibility Requirements

Accessibility is not a pass at the end. It is part of the design.

Do:

- Keep visible keyboard focus.
- Support keyboard-only navigation.
- Use semantic HTML.
- Use labels for all form controls.
- Use `aria-describedby` for hints/errors.
- Use `role="progressbar"` with values for progress.
- Use descriptive link text.
- Give touch-first and frequently used controls at least a 44×44px interaction
  target. The visible control may be smaller when its clickable area preserves
  the target.
- Ensure icons used as buttons have accessible names.
- Respect reduced motion.
- Test contrast in both themes.
- Check empty, loading, error, disabled, and long-content states.

Do not:

- Remove focus outlines.
- Use color alone to show selected/error/success states.
- Use `div`/`span` for buttons or links.
- Use `<b>`/`<i>` for meaning; use CSS for presentation and `strong`/`em`
  for semantic emphasis.
- Put block elements inside inline elements incorrectly.
- Use vague links such as `click here`.

Semantic structure:

- Use one unique `<main>` per page.
- Use `<header>`, `<nav>`, `<section>`, `<article>`, `<aside>`, and
  `<footer>` where they match the content.
- Use anchors for navigation and buttons for actions.
- Use `<figure>`/`<figcaption>` only when the image and caption form a
  self-contained unit.

## HTML, CSS, And Implementation Rules

### Web System Rules

Do:

- Use pnpm.
- Use Tailwind v4 CSS-first tokens in `apps/web/app/globals.css`.
- Use `cn()` for conditional classes.
- Reuse base UI components.
- Keep focus and contrast tests passing.
- Keep `tailwindcss` and `@tailwindcss/postcss` versions aligned.
- Use named token-backed utilities for visual values. Examples include
  `text-ui-sm`, `text-copy`, `max-w-form`, `max-w-content`,
  `min-h-control`, `min-h-field-message`, `shadow-card`, and
  `duration-progress`.

Do not:

- Create `tailwind.config.js`.
- Use raw hex values in components.
- Use arbitrary Tailwind values for visual styling, such as `text-[14px]`,
  `p-[18px]`, `rounded-[6px]`, `shadow-[...]`, `max-w-[440px]`, or
  `min-h-[var(--size-control)]`. If a value is missing, add or update the
  appropriate design token in `apps/web/app/globals.css`.
- Hand-roll buttons/inputs where base components fit.
- Add a separate UI pattern that duplicates an existing component.

### CSS Quality

The CSS PDFs focus on selector intent, reusability, and avoiding magic values.
In this Tailwind-heavy app, apply those rules through component structure and
class usage.

Do:

- Keep styling tied to what an element is, not where it happens to sit.
- Keep components reusable outside one parent layout.
- Use purposeful component and prop names.
- Keep selectors/classes short when writing custom CSS.
- Use relative line heights.
- Put responsive behavior near the component it affects.
- Comment only to explain non-obvious intent.

Do not:

- Use location-dependent selectors like "any button inside this promo block"
  for reusable components.
- Use qualified selectors that raise specificity without need.
- Use `!important` except as a documented last resort.
- Use inline styles for presentation when a token/class should be used.
- Mix container layout styles into a standalone component's core styles.

Example:

- Do: a `Button` that looks correct anywhere, with layout handled by the parent.
- Do not: a button that only looks correct inside `.signup-card .actions`.

## Copy And Language

UI copy is part of UX. It should be calm, specific, and plain.

Do:

- Use sentence case.
- Use direct verbs.
- Explain what happened and what to do next.
- Keep button labels action-specific.
- Use consistent vocabulary across similar actions.
- Use warm, non-scolding language.

Do not:

- Use double negatives.
- Shame, guilt, or pressure the user.
- Use vague modal choices like `Cancel` / `OK` when the action is destructive.
- Use fake urgency, scarcity, or manipulative language.
- Use technical codes as the only error message.

Examples:

- Do: `Remove data` and `Cancel`.
- Do not: `Deny` and `Forget`.
- Do: `Email is already used. Log in instead or use a different email.`
- Do not: `Unknown error 51526c`.

## Dark Patterns To Reject

Never implement patterns that mislead users, even if they increase a metric.

Reject:

- Sneaking extras into a cart or selection.
- Fake scarcity or urgency.
- Making signup easy but cancellation hard.
- Confirmshaming.
- Trick questions and double negatives.
- Hidden costs revealed late.
- Contact-import prompts that overreach.
- Ads or promotions disguised as product actions.
- Bait-and-switch offers.
- Misdirection that hides the user's preferred path.

FISH-specific concern:

- Neurodivergent users are especially harmed by confusing, pressuring, or
  choice-heavy flows. Ethical clarity is a product requirement, not a nice-to-have.

## Visual Styles And Effects

The style PDFs cover modern minimal, flat UI, dark mode, neumorphism,
glassmorphism, aurora gradients, claymorphism, neubrutalism, and other
trends. For FISH, treat these as cautionary references.

Do:

- Keep the product sparse, calm, readable, and focused.
- Use subtle roundness through tokens.
- Use solid surfaces for core task areas.
- Use effects only when they do not affect comprehension.
- Make the UI understandable if decorative effects are removed.

Do not:

- Use neumorphism for buttons, inputs, or essential controls.
- Use glassmorphism for forms, checkboxes, or text fields.
- Use aurora/blurred backgrounds behind core work.
- Use neubrutalist clash, loud outlines, or aggressive color unless the brand is
  intentionally changed.
- Use clay/3D styles for professional coaching workflows.

Acceptable exceptions:

- A small, non-essential illustration in an empty state.
- A subtle shadow in light mode from the `--shadow-card` token.
- A calm animation for incoming chat messages or loading feedback.

## UI Review Checklist

Use this checklist before approving UI work.

### Product Fit

- [ ] Does the screen remove choices instead of adding them?
- [ ] Is there exactly one primary action?
- [ ] Is the client experience assigned rather than browsed?
- [ ] Is any learning feature coach-validated?
- [ ] Can anything be removed without losing the task?

### Hierarchy And Layout

- [ ] Can you name the context, clarification, and action groups?
- [ ] Is the most important element noticed first?
- [ ] Are related items close and unrelated groups clearly separated?
- [ ] Does spacing follow a consistent 8-point/token-based system?
- [ ] Are desktop widths constrained enough for readable text?
- [ ] Does mobile stay single-column unless there is a strong reason?
- [ ] Are elements aligned to a clear grid or soft grid?

### Typography

- [ ] Does the screen use only a small number of text styles?
- [ ] Are body text, labels, headings, and meta text distinct?
- [ ] Is all important text readable at mobile size?
- [ ] Are line lengths comfortable?
- [ ] Is copy sentence case?
- [ ] Are all caps and thin fonts avoided?

### Color And Theme

- [ ] Are only design tokens used?
- [ ] Are raw hex values absent from web components?
- [ ] Does the UI work in monochrome hierarchy before color?
- [ ] Does the primary action pass contrast in both themes?
- [ ] Are feedback colors calm and semantic?
- [ ] Does dark mode preserve surface depth correctly?

### Components And States

- [ ] Are base UI components reused?
- [ ] Are default, hover, focus, active, disabled, loading, and error states
  handled where relevant?
- [ ] Do state changes preserve layout size?
- [ ] Are buttons direct, specific, and easy to tap?
- [ ] Are icon buttons accessible by name and target size?
- [ ] Are cards concise and free of filler?

### Forms

- [ ] Is there a real `<form>`?
- [ ] Does every input have a visible associated label?
- [ ] Are fields single-column and left-aligned?
- [ ] Are errors inline and helpful?
- [ ] Are autocomplete/type/inputmode/enterkeyhint used where helpful?
- [ ] Are optional fields marked without red required clutter?
- [ ] Are dropdowns avoided for short option sets?
- [ ] Are toggles used only for immediate settings?

### Accessibility

- [ ] Is keyboard navigation complete?
- [ ] Is focus visible on every interactive element?
- [ ] Are touch-first and frequently used targets at least 44×44px, including
  any invisible clickable padding?
- [ ] Does the UI avoid color-only communication?
- [ ] Does motion respect reduced-motion preferences?
- [ ] Do images have correct alt behavior?
- [ ] Are links descriptive?
- [ ] Is semantic HTML used correctly?

### Interaction And Feedback

- [ ] Does loading show progress, skeletons, or stable busy states?
- [ ] Are modals used only when unavoidable?
- [ ] Can overlays be closed easily?
- [ ] Is feedback placed near the object it concerns?
- [ ] Are animations calm and useful?
- [ ] Are empty states actionable without adding choices?

### Data And Content

- [ ] Are tables used only when structured comparison is needed?
- [ ] Are text and numbers aligned correctly in tables?
- [ ] Is mobile table content transformed or kept contextual?
- [ ] Are charts honest, readable, and not color-only?
- [ ] Is copy calm, plain, and non-scolding?
- [ ] Are dark patterns absent?

### Implementation

- [ ] Does web UI avoid `tailwind.config.js` and npm?
- [ ] Does custom CSS avoid magic numbers, `!important`, and
  location-dependent selectors?
- [ ] Are reusable components independent of parent layout?
- [ ] Are tests updated when shared behavior changes?
- [ ] Do `pnpm lint`, `pnpm typecheck`, and `pnpm build` remain the target
  verification commands before commit?

## Common Review Findings To Flag

Flag these as inconsistencies or implementation mistakes:

- More than one primary button in a view.
- Client-facing browsing of learning plans/templates.
- Touch-first or frequently used controls with targets below 44×44px.
- Raw color values in web components.
- Missing visible labels on inputs.
- Placeholder-only form fields.
- Red/scolding error copy.
- Vague button labels.
- Icon-only actions without accessible names or labels.
- Focus outlines removed or hidden.
- State changes that shift layout.
- Low-contrast muted text used for essential content.
- Decorative cards inside cards.
- Unvalidated gamification or punitive streak behavior.
- Modals/tooltips used for information that should be inline.
- Dropdowns for small option sets.
- Toggles used for form submission choices.
- Text or numbers centered in data tables.
- Images used as content without alt text.
- Background images used when the image is meaningful content.
- Custom CSS selectors tied to parent location rather than reusable intent.
