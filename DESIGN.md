---
name: FISH
description: Calm English coaching with one clear next step.
colors:
  canvas: "light-dark(oklch(0.98 0 0), oklch(0.15 0 0))"
  surface: "light-dark(oklch(0.99 0 0), oklch(0.18 0 0))"
  surface-subtle: "light-dark(oklch(0.96 0 0), oklch(0.20 0 0))"
  surface-hover: "light-dark(oklch(0.94 0 0), oklch(0.22 0 0))"
  surface-avatar: "light-dark(oklch(0.90 0 0), oklch(0.27 0 0))"
  surface-selected: "light-dark(oklch(0.88 0 0), oklch(0.33 0 0))"
  border-control: "light-dark(oklch(0.64 0 0), oklch(0.55 0 0))"
  border-strong: "light-dark(oklch(0.55 0 0), oklch(0.65 0 0))"
  divider: "light-dark(oklch(0.15 0 0 / 0.1), oklch(0.98 0 0 / 0.12))"
  primary: "light-dark(oklch(0.15 0 0), oklch(0.98 0 0))"
  primary-press: "light-dark(oklch(0.25 0 0), oklch(0.90 0 0))"
  on-primary: "light-dark(oklch(0.98 0 0), oklch(0.15 0 0))"
  foreground: "light-dark(oklch(0.15 0 0), oklch(0.97 0 0))"
  body: "light-dark(oklch(0.32 0 0), oklch(0.88 0 0))"
  muted: "light-dark(oklch(0.50 0 0), oklch(0.68 0 0))"
  notice: "light-dark(oklch(0.40 0 0), oklch(0.80 0 0))"
  error: "light-dark(oklch(0.45 0.14 20), oklch(0.78 0.11 20))"
  warning: "light-dark(oklch(0.42 0.12 80), oklch(0.78 0.12 80))"
  success: "light-dark(oklch(0.40 0.11 150), oklch(0.75 0.12 150))"
  scrim: "light-dark(oklch(0.15 0 0 / 0.4), oklch(0 0 0 / 0.6))"
typography:
  display:
    fontFamily: "var(--font-fraunces), ui-serif, Georgia, serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "var(--font-fraunces), ui-serif, Georgia, serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-lexend), ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  ui:
    fontFamily: "var(--font-lexend), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-lexend), ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "normal"
  caption:
    fontFamily: "var(--font-lexend), ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  card: "16px"
  chat: "16px"
  control: "12px"
  chat-inner: "4px"
  pill: "999px"
spacing:
  3xs: "2px"
  2xs: "4px"
  nudge: "6px"
  xs: "8px"
  compact: "10px"
  sm: "12px"
  field-y: "14px"
  md: "16px"
  page: "20px"
  lg: "24px"
  xl: "40px"
  2xl: "48px"
  3xl: "72px"
  4xl: "112px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.primary-press}"
    textColor: "{colors.on-primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.foreground}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  input-default:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.body}"
    rounded: "{rounded.card}"
    padding: "16px"
  progress-track:
    backgroundColor: "{colors.surface-subtle}"
    rounded: "{rounded.pill}"
    height: "12px"
    width: "100%"
  progress-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    height: "12px"
  alert-notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.body}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "16px"
---

# Design System: FISH

## Overview

**Creative North Star: "The Quiet Current"**

FISH should feel like moving with a gentle current: the direction is clear, the pace is calm, and the interface never asks the user to steer around avoidable choices. It is a sparse coaching product for neurodivergent professionals, so hierarchy, spacing, familiar controls, and plain language carry more weight than decoration.

The visual system is restrained and primarily monochrome. Near-white and near-black canvases reverse across light and dark themes, while small tonal steps separate surfaces without visual noise. The single primary action is a full-contrast inversion, not a colorful accent. Calm, desaturated semantic hues appear only when status needs to be recognized quickly.

The system explicitly rejects noisy course marketplaces, gamified streak trackers, dashboards that expose every possible option, decorative SaaS patterns, competing calls to action, alarming error treatments, punitive progress, plan galleries, and interaction patterns that demand unnecessary decisions from clients.

**Key Characteristics:**

- One unmistakable action and quietly subordinated alternatives.
- Monochrome hierarchy supported by generous, token-based spacing.
- Warm Fraunces headings paired with highly readable Lexend UI text.
- Flat surfaces separated by lightness steps and hairline dividers.
- Accessible, layout-stable controls with calm state feedback.
- Single-column client flows, constrained text widths, and predictable navigation.

**The One Clear Direction Rule.** Every view has at most one primary action. Remove or quiet every competing choice until the next useful step is obvious.

## Colors

The Quiet Current palette is neutral, reversible, and intentionally low stimulation. Lightness establishes hierarchy; hue is reserved for calm semantic feedback.

### Primary

- **Full-contrast current:** The primary token is the one visually dominant action on a screen. It inverts with the theme and changes by one neutral lightness step on hover or press.
- **Current text:** The on-primary token maintains maximum readable contrast inside the inverted action.

### Secondary

- **Soft rose:** Error feedback uses a desaturated coral tone for messages that block continuation. Pair it with an icon, a plain explanation, and a next step.
- **Soft amber:** Warning feedback signals caution without alarm.
- **Soft green:** Success feedback confirms completion without turning the screen into a reward display.

### Neutral

- **Open water:** Canvas is the page background and the quietest visual plane.
- **Near surface:** Surface frames cards, inputs, menus, and elevated containers while staying close to the canvas.
- **Shallow step:** Surface subtle creates wells, selected regions, progress tracks, and secondary buttons.
- **Interaction step:** Hover and selected surface tokens communicate state through lightness rather than hue.
- **Readable ink:** Foreground, body, and muted tokens form the text hierarchy. Muted is only for genuinely secondary content.
- **Calm boundary:** Control borders retain semantic contrast; divider is a decorative hairline and must never substitute for a control boundary.
- **Neutral notice:** Informational feedback stays monochrome and relies on icon shape, placement, and copy.

**The Monochrome First Rule.** A screen must remain understandable before semantic hues are applied. Color clarifies status; it never decorates.

**The Full-Contrast Action Rule.** Primary is an inversion, not a brand hue. Use it once per view and never on inactive or decorative elements.

**The Calm Feedback Rule.** Never rely on color alone. Semantic hues must remain desaturated and appear with an icon, weight change, label, or message.

## Typography

**Display Font:** Fraunces (with Georgia and ui-serif fallbacks)
**Body Font:** Lexend (with system UI fallbacks)
**Label Font:** Lexend (with system UI fallbacks)

**Character:** Fraunces gives headings warmth and a human coaching voice. Lexend keeps reading and interaction text clear for users who benefit from stable, open letterforms and generous rhythm.

### Hierarchy

- **Display** (600, 32px, 1.1): Product-level titles and compact brand statements. Marketing-only hero type may use the existing fluid hero token.
- **Heading** (600, 20px, 1.15): Screen and section headings. Fraunces is never used for buttons, labels, or dense data.
- **Body** (400, 17px, 1.55): Explanations, form guidance, and conversation copy. Prose should stay within roughly 65 to 75 characters per line.
- **UI** (400, 15px, 1.5): Menus, compact interface copy, and supporting labels.
- **Label** (500, 14px, 1.45): Field labels and high-importance compact guidance.
- **Caption** (400, 13px, 1.4): Secondary metadata only. Never use caption styling for information required to complete a task.

**The Small Ladder Rule.** Most product screens use three or four text styles. Do not add near-duplicate sizes or viewport-scaled product typography.

**The Sentence Case Rule.** Buttons, labels, notices, and navigation use sentence case. All caps is reserved for very short, low-priority orientation labels.

## Elevation

FISH is flat by design and uses no shadows. Depth comes from ordered surface lightness, hairline dividers, spacing, and the modal scrim. In dark mode, the visually closer layer is lighter than the canvas. Cards do not float, inputs do not glow, and state changes never add a shadow.

**The Surface Step Rule.** Move one deliberate surface step to express containment, hover, or selection. Never invent an isolated fill value inside a component.

**The No Shadow Rule.** Box shadows and text shadows are prohibited. If a component needs separation, fix its spacing, surface role, border semantics, or information hierarchy.

**The Layout Stability Rule.** Hover, focus, validation, loading, and disabled states must preserve the component's geometry.

## Components

The component vocabulary is rounded, quiet, and familiar. Reuse the base components in `apps/web/components/ui/` and extend them before creating a new visual pattern.

### Buttons

- **Shape:** Gently rounded rectangle using the control radius (12px).
- **Primary:** Full-contrast inverted fill, semibold Lexend UI text, 16px horizontal padding, and 56px minimum height. There may be only one per view.
- **Secondary:** A surface-subtle well with foreground text and a 44px minimum height. Hover advances to the selected surface step.
- **Ghost:** Transparent with muted text and a 44px minimum height. Hover strengthens text to body color without adding a fill.
- **Hover / Focus:** Hover changes only existing color tokens. Keyboard focus lowers opacity to a visible calm state; no ring, glow, or shadow is introduced.
- **Disabled / Loading:** Opacity communicates reduced availability. Loading overlays a quiet spinner while retaining the label's dimensions, disables repeat activation, and sets `aria-busy`.

### Cards / Containers

- **Corner Style:** Soft card radius (16px).
- **Background:** Surface by default, with surface-subtle reserved for a meaningful alternate plane.
- **Shadow Strategy:** None. Tonal layering and whitespace provide separation.
- **Border:** No default border. Hairline divider borders are allowed when separating repeated content.
- **Internal Padding:** Standard component spacing (16px). Larger padding must come from a named spacing token and a clear layout need.

### Inputs / Fields

- **Style:** Borderless surface-subtle well, control radius (12px), foreground 17px Lexend text, 16px horizontal padding, and a 44px minimum height.
- **Labels:** Visible, left-aligned, medium-weight 14px labels above the field. A placeholder never replaces a label.
- **Focus:** Focus moves the field to the selected surface step and adjusts opacity. It does not add a glow or move the layout.
- **Feedback:** Notice uses a stronger neutral border; error uses the calm error border. Both place icon-supported, plain-language guidance below the field in a reserved message row when layout stability requires it.
- **Disabled:** Reduced opacity while preserving readable content and field geometry.

### Navigation

- **Style:** Labeled Tabler icons with 20px glyphs, 44px minimum targets, 12px corners, and 14px Lexend text.
- **Desktop:** A familiar top bar with the logo, a small set of role-appropriate links, and one quiet account menu.
- **Mobile:** A fixed bottom bar with evenly distributed labeled destinations. Active state combines a tonal well, stronger text, and semibold weight.
- **Immersive chat:** A single channel may appear in a narrow desktop rail for orientation. This is not permission to create a browsable client plan menu.

### Progress

- **Style:** A 12px pill track in surface-subtle with a full-contrast primary fill.
- **Behavior:** Width changes over 500ms and reduced-motion preferences clamp the transition. Progress may name the current step but must never present a score or percentage as judgement.

### Alerts

- **Style:** Surface background, 12px corners, 16px padding, a hairline semantic border, and a 20px Tabler icon.
- **Tones:** Notice remains monochrome. Warning and error use semibold messages; success remains calm and regular weight.
- **Copy:** State what happened and what the user can do next. Never prefix a message with `Error`, expose a raw technical code, or use exclamation-heavy language.

### Chat Feedback

- **Message entrance:** A 200ms opacity and 6px translate settle, never a bounce.
- **Typing:** Three restrained dots may animate to indicate live activity; reduced-motion preferences stop the loop.
- **Reactions:** A brief 180ms scale response confirms the action. Reactions are rewards and acknowledgements, never scores or streaks.
- **Loading:** Skeletons use an opacity pulse, never a shimmer sweep.

**The Familiar Control Rule.** Buttons look like buttons, links navigate, fields have labels, and navigation remains visible. Novel interaction patterns require a task-specific accessibility reason.

## Do's and Don'ts

### Do:

- **Do** reduce each screen to one obvious next action and at most one primary button.
- **Do** use only CSS-first tokens from `apps/web/app/globals.css`; add a named token before introducing a genuinely new visual value.
- **Do** use the existing `Button`, `Input`, `Card`, `Progress`, and `Alert` components before creating another pattern.
- **Do** keep touch-first and frequently used controls at least 44 by 44px, with focused primary actions at 56px when prominence supports focus.
- **Do** use surface steps, whitespace, and hairline dividers instead of shadows.
- **Do** keep client flows assigned rather than browsed, narrow, and single-column by default.
- **Do** pair status color with an icon, message, weight, or shape so meaning never depends on hue alone.
- **Do** write sentence-case, direct, non-scolding copy that explains the next useful step.
- **Do** respect OS and saved light, dark, and reduced-motion preferences.

### Don't:

- **Don't** resemble a noisy course marketplace, a gamified streak tracker, or a dashboard that exposes every possible option at once.
- **Don't** add decorative SaaS patterns, competing calls to action, alarming error treatments, punitive progress, plan galleries, or interaction patterns that demand unnecessary decisions from clients.
- **Don't** let clients browse menus, galleries, or multi-choice pickers for learning plans or templates.
- **Don't** use more than one primary button per view.
- **Don't** use raw hex values, arbitrary Tailwind values, one-off numeric spacing utilities, or a `tailwind.config.js` in the web app.
- **Don't** use box shadows, text shadows, glows, glassmorphism, neumorphism, aurora backgrounds, loud outlines, or nested cards.
- **Don't** use a colored side stripe, gradient text, decorative blur, or a modal as the first solution.
- **Don't** use pure black and pure white as hard-coded colors. Use the theme-aware OKLCH tokens.
- **Don't** use Fraunces in buttons, form labels, navigation, data, or other dense UI.
- **Don't** use placeholders as labels, vague action copy, raw technical errors, scolding language, or hue as the only state cue.
- **Don't** animate layout properties, use bounce or elastic easing, run decorative motion, or ignore reduced-motion preferences.
- **Don't** show scores, percentages as judgement, broken streaks, or any reset-to-zero punishment.
